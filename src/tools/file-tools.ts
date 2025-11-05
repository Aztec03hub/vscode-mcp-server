import * as vscode from "vscode";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Type for file listing results
export type FileListingResult = Array<{
  path: string;
  type: "file" | "directory";
}>;

// Type for the file listing callback function
export type FileListingCallback = (
  path: string,
  recursive: boolean,
) => Promise<FileListingResult>;

// Default maximum character count
const DEFAULT_MAX_CHARACTERS = 200000;

// Default model for token counting
const DEFAULT_TOKEN_COUNTING_MODEL = 'claude-sonnet-4-5-20250929';

// File size limits for token counting
const TOKEN_COUNTING_FILE_SIZE_WARNING_BYTES = 16 * 1024 * 1024; // 16MB
const TOKEN_COUNTING_FILE_SIZE_LIMIT_BYTES = 512 * 1024 * 1024; // 512MB

/**
 * Lists files and directories in the VS Code workspace
 * @param workspacePath The path within the workspace to list files from
 * @param recursive Whether to list files recursively
 * @returns Array of file and directory entries
 */
export async function listWorkspaceFiles(
  workspacePath: string,
  recursive: boolean = false,
): Promise<FileListingResult> {
  console.log(
    `[listWorkspaceFiles] Starting with path: ${workspacePath}, recursive: ${recursive}`,
  );

  if (!vscode.workspace.workspaceFolders) {
    throw new Error("No workspace folder is open");
  }

  const workspaceFolder = vscode.workspace.workspaceFolders[0];
  const workspaceUri = workspaceFolder.uri;

  // Create URI for the target directory
  const targetUri = vscode.Uri.joinPath(workspaceUri, workspacePath);
  console.log(`[listWorkspaceFiles] Target URI: ${targetUri.fsPath}`);

  async function processDirectory(
    dirUri: vscode.Uri,
    currentPath: string = "",
  ): Promise<FileListingResult> {
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    const result: FileListingResult = [];

    for (const [name, type] of entries) {
      const entryPath = currentPath ? path.join(currentPath, name) : name;
      const itemType: "file" | "directory" =
        type & vscode.FileType.Directory ? "directory" : "file";

      result.push({ path: entryPath, type: itemType });

      if (recursive && itemType === "directory") {
        const subDirUri = vscode.Uri.joinPath(dirUri, name);
        const subEntries = await processDirectory(subDirUri, entryPath);
        result.push(...subEntries);
      }
    }

    return result;
  }

  try {
    const result = await processDirectory(targetUri);
    console.log(`[listWorkspaceFiles] Found ${result.length} entries`);
    return result;
  } catch (error) {
    console.error("[listWorkspaceFiles] Error:", error);
    throw error;
  }
}

// Type for file read result with metadata
export type FileReadResult = {
  content: Uint8Array | string;
  metadata?: {
    linesLeftToEndLine: number;
    linesLeftToEOF: number;
    outputTruncated: boolean;
    outputToLine: number;
    requestedEndLine: number;
    totalLines: number;
  };
};

/**
 * Reads a file from the VS Code workspace with character limit check and metadata
 * @param workspacePath The path within the workspace to the file
 * @param encoding Optional encoding to convert the file content to a string
 * @param maxCharacters Maximum character count (default: 200,000)
 * @param startLine The start line number (1-based, inclusive). Use -1 to read from the beginning.
 * @param endLine The end line number (1-based, inclusive). Use -1 to read to the end.
 * @returns Object containing file content and metadata about truncation/remaining lines
 */
export async function readWorkspaceFile(
  workspacePath: string,
  encoding?: string | null,
  maxCharacters: number = DEFAULT_MAX_CHARACTERS,
  startLine: number = -1,
  endLine: number = -1,
): Promise<FileReadResult> {
  console.log(
    `[readWorkspaceFile] Starting with path: ${workspacePath}, encoding: ${encoding || "none"}, maxCharacters: ${maxCharacters}, startLine: ${startLine}, endLine: ${endLine}`,
  );

  if (!vscode.workspace.workspaceFolders) {
    throw new Error("No workspace folder is open");
  }

  const workspaceFolder = vscode.workspace.workspaceFolders[0];
  const workspaceUri = workspaceFolder.uri;

  // Create URI for the target file
  const fileUri = vscode.Uri.joinPath(workspaceUri, workspacePath);
  console.log(`[readWorkspaceFile] File URI: ${fileUri.fsPath}`);

  try {
    // Read the file content as Uint8Array
    const fileContent = await vscode.workspace.fs.readFile(fileUri);
    console.log(
      `[readWorkspaceFile] File read successfully, size: ${fileContent.byteLength} bytes`,
    );

    // If encoding is provided, convert to string and check character count
    if (encoding) {
      const textDecoder = new TextDecoder(encoding);
      const textContent = textDecoder.decode(fileContent);

      // If line numbers are specified and valid, extract just those lines with smart truncation
      if (startLine > 0 || endLine > 0) {
        // Split the content into lines
        const lines = textContent.split("\n");
        const totalLines = lines.length;

        // Convert 1-based line numbers to 0-based for array indexing
        // startLine > 0 means user specified a line (1-based), convert to 0-based
        // startLine <= 0 means read from beginning (use 0)
        const effectiveStartLine = startLine > 0 ? startLine - 1 : 0;
        const effectiveEndLine =
          endLine > 0
            ? Math.min(endLine - 1, lines.length - 1)
            : lines.length - 1;

        // Validate line numbers (using 1-based for error messages)
        if (startLine > lines.length) {
          throw new Error(
            `Start line ${startLine} is out of range (1-${lines.length})`,
          );
        }

        // Make sure endLine is not less than startLine (use 1-based for error message)
        if (endLine > 0 && endLine < startLine) {
          throw new Error(
            `End line ${endLine} is less than start line ${startLine}`,
          );
        }

        // Reserve 1000 characters for metadata formatting
        const METADATA_RESERVE = 1000;
        const outputCharacterBudget = 99000; // 100000 (Claude limit) - 1000 (metadata) = 99000

        // Extract the requested lines and join them back together
        const requestedLines = lines.slice(
          effectiveStartLine,
          effectiveEndLine + 1,
        );
        let partialContent = requestedLines.join("\n");

        // Track the actual end line we output (may be truncated)
        let outputToLine = effectiveEndLine + 1; // Convert back to 1-based
        let outputTruncated = false;

        // Check if the content exceeds our output character budget
        if (partialContent.length > outputCharacterBudget) {
          console.log(
            `[readWorkspaceFile] Content exceeds budget (${partialContent.length} > ${outputCharacterBudget}), truncating...`,
          );

          // Find the last complete line that fits within the budget
          let currentLength = 0;
          let lastCompleteLineIndex = -1;

          for (let i = 0; i < requestedLines.length; i++) {
            const lineLength = requestedLines[i].length + 1; // +1 for newline
            if (currentLength + lineLength > outputCharacterBudget) {
              break;
            }
            currentLength += lineLength;
            lastCompleteLineIndex = i;
          }

          if (lastCompleteLineIndex < 0) {
            // Even first line exceeds budget - this is an error condition
            throw new Error(
              `First line exceeds output character budget (${outputCharacterBudget} characters). Cannot read file.`,
            );
          }

          // Truncate to last complete line
          partialContent = requestedLines
            .slice(0, lastCompleteLineIndex + 1)
            .join("\n");
          outputToLine = effectiveStartLine + lastCompleteLineIndex + 1; // Convert to 1-based
          outputTruncated = true;

          console.log(
            `[readWorkspaceFile] Truncated at line ${outputToLine}, output length: ${partialContent.length} characters`,
          );
        }

        // Calculate metadata
        const requestedEndLine = endLine > 0 ? endLine : totalLines;
        const linesLeftToEndLine = requestedEndLine - outputToLine;
        const linesLeftToEOF = totalLines - outputToLine;

        // Log with 1-based line numbers for user clarity
        const displayStartLine = startLine > 0 ? startLine : 1;
        console.log(
          `[readWorkspaceFile] Returning lines ${displayStartLine}-${outputToLine}, length: ${partialContent.length} characters`,
        );
        console.log(
          `[readWorkspaceFile] Metadata: truncated=${outputTruncated}, linesLeftToEndLine=${linesLeftToEndLine}, linesLeftToEOF=${linesLeftToEOF}`,
        );

        return {
          content: partialContent,
          metadata: {
            linesLeftToEndLine,
            linesLeftToEOF,
            outputTruncated,
            outputToLine,
            requestedEndLine,
            totalLines,
          },
        };
      }

      // For full file reads (no line filtering), check the full content against the limit
      if (textContent.length > maxCharacters) {
        throw new Error(
          `File content exceeds the maximum character limit (${textContent.length} vs ${maxCharacters} allowed)`,
        );
      }

      return { content: textContent };
    } else {
      // For binary content, use byte length as approximation
      if (fileContent.byteLength > maxCharacters) {
        throw new Error(
          `File content exceeds the maximum character limit (approx. ${fileContent.byteLength} bytes vs ${maxCharacters} allowed)`,
        );
      }

      // For binary files, we cannot extract lines, so we ignore startLine and endLine
      if (startLine > 0 || endLine > 0) {
        console.warn(
          `[readWorkspaceFile] Line numbers specified for binary file, ignoring`,
        );
      }

      // Otherwise return the raw bytes (no metadata for binary files)
      return { content: fileContent };
    }
  } catch (error) {
    console.error("[readWorkspaceFile] Error:", error);
    throw error;
  }
}

/**
 * Call Anthropic's Token Counting API
 * @param text The text content to count tokens for
 * @param model The model to use for token counting
 * @returns Promise resolving to the token count
 */
async function callAnthropicTokenCountingAPI(
  text: string,
  model: string,
): Promise<{ input_tokens: number }> {
  console.log(
    `[callAnthropicTokenCountingAPI] Calling API with model: ${model}, text length: ${text.length}`,
  );

  // Get API key from environment
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is not set. Please set it to use the token counting feature.',
    );
  }

  // Prepare request body
  const requestBody = {
    model: model,
    messages: [
      {
        role: 'user',
        content: text,
      },
    ],
  };

  try {
    // Use Node.js https module for API call
    const https = require('https');
    const requestData = JSON.stringify(requestBody);

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages/count_tokens',
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData),
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res: any) => {
        let data = '';

        res.on('data', (chunk: any) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              console.error(
                `[callAnthropicTokenCountingAPI] API returned status ${res.statusCode}: ${data}`,
              );
              reject(
                new Error(
                  `Anthropic API error (${res.statusCode}): ${data}`,
                ),
              );
              return;
            }

            const response = JSON.parse(data);
            console.log(
              `[callAnthropicTokenCountingAPI] API returned ${response.input_tokens} tokens`,
            );
            resolve(response);
          } catch (error) {
            console.error(
              '[callAnthropicTokenCountingAPI] Failed to parse response:',
              error,
            );
            reject(new Error(`Failed to parse API response: ${error}`));
          }
        });
      });

      req.on('error', (error: any) => {
        console.error(
          '[callAnthropicTokenCountingAPI] Request failed:',
          error,
        );
        reject(new Error(`API request failed: ${error.message}`));
      });

      req.write(requestData);
      req.end();
    });
  } catch (error) {
    console.error('[callAnthropicTokenCountingAPI] Error:', error);
    throw error;
  }
}

/**
/**
 * Validate token counting parameters
 * @param params The parameters to validate
 * @throws Error if validation fails
 */
  function validateTokenCountingParams(params: {
  text?: string;
  filepath?: string;
  startLine?: number;
  endLine?: number;
  lineRanges?: Array<{ startLine: number; endLine?: number; description?: string }>;
  }): void {
  console.log('[validateTokenCountingParams] Validating parameters');

  // Exactly one of text, filepath, or filepath+lineRanges must be provided
  if (!params.text && !params.filepath) {
    throw new Error(
      'Either "text" or "filepath" parameter must be provided',
    );
  }
  if (params.text && params.filepath) {
    throw new Error(
      'Cannot provide both "text" and "filepath" parameters. Please use only one.',
    );
  }

  // Cannot use both single range and lineRanges
  if ((params.startLine || params.endLine) && params.lineRanges) {
    throw new Error(
      'Cannot use both "startLine"/"endLine" and "lineRanges" parameters. Please use only one range specification method.',
    );
  }

  // startLine/endLine and lineRanges are mutually exclusive
  if ((params.startLine || params.endLine) && params.lineRanges) {
    throw new Error(
      'Cannot use both "startLine"/"endLine" and "lineRanges". Please use only one approach.',
    );
  }

  // startLine and endLine require filepath
  if ((params.startLine || params.endLine) && !params.filepath) {
    throw new Error(
      'Parameters "startLine" and "endLine" can only be used with "filepath"',
    );
  }

  // lineRanges requires filepath
  if (params.lineRanges && !params.filepath) {
    throw new Error(
      'Parameter "lineRanges" can only be used with "filepath"',
    );
  }

  // Validate line numbers if provided (legacy single range)
  if (params.startLine !== undefined && params.startLine < 1) {
    throw new Error('"startLine" must be >= 1');
  }
  if (params.endLine !== undefined && params.endLine < 1) {
    throw new Error('"endLine" must be >= 1');
  }
  if (
    params.startLine !== undefined &&
    params.endLine !== undefined &&
    params.startLine > params.endLine
  ) {
    throw new Error('"startLine" must be <= "endLine"');
  }

  // Validate lineRanges if provided
  if (params.lineRanges) {
    if (params.lineRanges.length === 0) {
      throw new Error('"lineRanges" must contain at least one range');
    }
    for (let i = 0; i < params.lineRanges.length; i++) {
      const range = params.lineRanges[i];
      if (range.startLine < 1) {
        throw new Error(`lineRanges[${i}].startLine must be >= 1`);
      }
      if (range.endLine !== undefined && range.endLine < 1) {
        throw new Error(`lineRanges[${i}].endLine must be >= 1`);
      }
      if (range.endLine !== undefined && range.startLine > range.endLine) {
        throw new Error(`lineRanges[${i}].startLine must be <= endLine`);
      }
    }
  }

  // Validate lineRanges if provided
  if (params.lineRanges) {
    if (!Array.isArray(params.lineRanges) || params.lineRanges.length === 0) {
      throw new Error('"lineRanges" must be a non-empty array');
    }

    params.lineRanges.forEach((range, index) => {
      if (!range.startLine || range.startLine < 1) {
        throw new Error(`lineRanges[${index}]: "startLine" must be >= 1`);
      }
      if (range.endLine !== undefined) {
        if (range.endLine < 1) {
          throw new Error(`lineRanges[${index}]: "endLine" must be >= 1`);
        }
        if (range.startLine > range.endLine) {
          throw new Error(
            `lineRanges[${index}]: "startLine" (${range.startLine}) must be <= "endLine" (${range.endLine})`,
          );
        }
      }
    });
  }

  console.log('[validateTokenCountingParams] Validation passed');
}

/**
 * Get file content for token counting with size validation
 * @param filepath The path to the file
 * @param startLine Optional 1-based start line
 * @param endLine Optional 1-based end line
 * @returns Promise resolving to content and metadata
 */
async function getFileContentForTokenCounting(
  filepath: string,
  startLine?: number,
  endLine?: number,
): Promise<{
  content: string;
  characterCount: number;
  linesProcessed?: string;
  fileSizeWarning?: string;
}> {
  console.log(
    `[getFileContentForTokenCounting] Reading file: ${filepath}, startLine: ${startLine || 'N/A'}, endLine: ${endLine || 'N/A'}`,
  );

  if (!vscode.workspace.workspaceFolders) {
    throw new Error('No workspace folder is open');
  }

  const workspaceFolder = vscode.workspace.workspaceFolders[0];
  const workspaceUri = workspaceFolder.uri;
  const fileUri = vscode.Uri.joinPath(workspaceUri, filepath);

  // Check file size before reading
  try {
    const fileStat = await vscode.workspace.fs.stat(fileUri);
    const fileSizeBytes = fileStat.size;

    console.log(
      `[getFileContentForTokenCounting] File size: ${fileSizeBytes} bytes`,
    );

    // Check size limits
    if (fileSizeBytes > TOKEN_COUNTING_FILE_SIZE_LIMIT_BYTES) {
      throw new Error(
        `File size (${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds the 512MB limit for token counting`,
      );
    }

    let fileSizeWarning: string | undefined = undefined;
    if (fileSizeBytes > TOKEN_COUNTING_FILE_SIZE_WARNING_BYTES) {
      fileSizeWarning = `Warning: File size is ${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB (>16MB). This may take longer to process.`;
      console.warn(`[getFileContentForTokenCounting] ${fileSizeWarning}`);
    }

    // Read file content using existing function
    const result = await readWorkspaceFile(
      filepath,
      'utf-8',
      DEFAULT_MAX_CHARACTERS,
      startLine || -1,
      endLine || -1,
    );

    let content: string;
    let linesProcessed: string | undefined = undefined;

    if (typeof result.content === 'string') {
      content = result.content;

      // Build linesProcessed string if line range was specified
      if (result.metadata) {
        const displayStartLine = startLine || 1;
        linesProcessed = `${displayStartLine}-${result.metadata.outputToLine}`;
        console.log(
          `[getFileContentForTokenCounting] Processed lines: ${linesProcessed}`,
        );
      }
    } else {
      throw new Error(
        'File content is binary. Token counting only supports text files.',
      );
    }

    return {
      content,
      characterCount: content.length,
      linesProcessed,
      fileSizeWarning,
    };
  } catch (error) {
    console.error('[getFileContentForTokenCounting] Error:', error);
    throw error;
  }
}

/**
 * Registers MCP file-related tools with the server
 * @param server MCP server instance
 * @param fileListingCallback Callback function for file listing operations
 */
export function registerFileTools(
  server: McpServer,
  fileListingCallback: FileListingCallback,
): void {
  // Add list_files tool
  server.tool(
    "list_files_code",
    `Use this tool to explore the directory structure of the VS Code workspace.

        Key features:
        - Returns a list of files and directories at the specified path
        - When 'recursive' is set to true, it includes all nested files and subdirectories
        
        Use cases:
        - Understanding project structure
        - Finding specific file types
        - Verifying file existence before read/modify operations
        
        Recommendation:
        Start by exploring the root directory with path='.' before diving into specific subdirectories.
        Do not EVER set 'recursive' to true in the root directory as the output may be too large.
        Instead, use it to explore specific subdirectories.
        `,
    {
      path: z.string().describe("The path to list files from"),
      recursive: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to list files recursively"),
    },
    async ({ path, recursive = false }): Promise<CallToolResult> => {
      console.log(
        `[list_files] Tool called with path=${path}, recursive=${recursive}`,
      );

      if (!fileListingCallback) {
        console.error("[list_files] File listing callback not set");
        throw new Error("File listing callback not set");
      }

      try {
        console.log("[list_files] Calling file listing callback");
        const files = await fileListingCallback(path, recursive);
        console.log(`[list_files] Callback returned ${files.length} items`);

        const result: CallToolResult = {
          content: [
            {
              type: "text",
              text: JSON.stringify(files, null, 2),
            },
          ],
        };
        console.log("[list_files] Successfully completed");
        return result;
      } catch (error) {
        console.error("[list_files] Error in tool:", error);
        throw error;
      }
    },
  );

  // Update read_file tool with line number parameters
  server.tool(
    "read_file_code",
    `Use this tool to retrieve and analyze the contents of a file in the VS Code workspace.

        Key features:
        - Returns text content with optional encoding support (default: utf-8)
        - Enforces character limit (default: 200,000) to prevent loading large files
        - Supports partial file reading using line numbers (startLine, endLine)
        
        Use cases:
        - Understanding/analyzing/reviewing existing code implementations, patterns, dependencies, and config files
        - Extracting specific sections of large files
        
        Recommendation:
        - Use startLine and endLine parameters for large files to read only the relevant portions.
        - For text files, utf-8 encoding recommended`,
    {
      path: z.string().describe("The path to the file to read"),
      encoding: z
        .string()
        .optional()
        .default("utf-8")
        .describe("Optional encoding to convert the file content to a string"),
      maxCharacters: z
        .number()
        .optional()
        .default(DEFAULT_MAX_CHARACTERS)
        .describe("Maximum character count (default: 200,000)"),
      startLine: z
        .number()
        .optional()
        .default(-1)
        .describe(
          "The start line number (1-based, inclusive). Default: read from beginning, denoted by -1",
        ),
      endLine: z
        .number()
        .optional()
        .default(-1)
        .describe(
          "The end line number (1-based, inclusive). Default: read to end, denoted by -1",
        ),
    },
    async ({
      path,
      encoding = "utf-8",
      maxCharacters = DEFAULT_MAX_CHARACTERS,
      startLine = -1,
      endLine = -1,
    }): Promise<CallToolResult> => {
      console.log(
        `[read_file] Tool called with path=${path}, encoding=${encoding || "none"}, maxCharacters=${maxCharacters}, startLine=${startLine}, endLine=${endLine}`,
      );

      try {
        console.log("[read_file] Reading file");
        const result = await readWorkspaceFile(
          path,
          encoding,
          maxCharacters,
          startLine,
          endLine,
        );

        let resultContent: string;

        // Check if result has content property (new structure) or is direct content (binary)
        const fileContent = "content" in result ? result.content : result;
        const metadata = "metadata" in result ? result.metadata : undefined;

        if (fileContent instanceof Uint8Array) {
          // For binary data, convert to base64
          const base64 = Buffer.from(fileContent).toString("base64");
          resultContent = `Binary file, base64 encoded: ${base64}`;
          console.log(
            `[read_file] File read as binary, base64 length: ${base64.length}`,
          );
        } else {
          // For text data, format with sections and metadata
          let formattedOutput = "**File Contents:**\n";
          formattedOutput += fileContent;
          formattedOutput += "\n**End Of File Contents.**\n\n";

          // Add metadata section if available
          if (metadata) {
            formattedOutput += "**Tool Result Details:**\n";
            formattedOutput += `- outputToLine: ${metadata.outputToLine}\n`;
            formattedOutput += `- outputTruncated: ${metadata.outputTruncated}\n`;
            formattedOutput += `- linesLeftToEndLine: ${metadata.linesLeftToEndLine}\n`;
            formattedOutput += `- linesLeftToEOF: ${metadata.linesLeftToEOF}\n`;
            formattedOutput += `- linesInFile: ${metadata.totalLines}\n`;

            // Add truncation warning if needed
            if (metadata.outputTruncated) {
              formattedOutput += `- WARNING! FILE CONTENTS OUTPUT > 99000 CHARACTERS, OUTPUT TRUNCATED! PLEASE USE 'read_file_code' TOOL AGAIN WITH 'startLine': ${metadata.outputToLine + 1}, 'endLine': ${metadata.requestedEndLine}\n`;
            }

            // Add lines left to EOF warning if needed
            if (metadata.linesLeftToEOF > 0) {
              formattedOutput += `- WARNING! ${metadata.linesLeftToEOF} LINES LEFT TO EOF, IF FULL/COMPLETE FILE CONTENTS IS NEEDED IN CONTEXT, PLEASE USE 'read_file_code' TOOL AGAIN WITH 'startLine': ${metadata.outputToLine + 1}, 'endLine': ${metadata.totalLines}\n`;
            }
          }

          resultContent = formattedOutput;
          console.log(
            `[read_file] File read as text, length: ${fileContent.length} characters`,
          );
        }

        const callToolResult: CallToolResult = {
          content: [
            {
              type: "text",
              text: resultContent,
            },
          ],
        };
        console.log("[read_file] Successfully completed");
        return callToolResult;
      } catch (error) {
        console.error("[read_file] Error in tool:", error);
        throw error;
      }
    },
  );

  // Add count_tokens tool
  server.tool(
    'count_tokens',
    `Use this tool to count tokens using Anthropic's official API.

        Features:
        - Direct text or file input (with optional line ranges)
        - Multiple discontinuous ranges supported
        - Returns token count, character count, and metadata

        Requirements:
        - ANTHROPIC_API_KEY env var must be set
        - 'text' or 'filepath' param required (not both)
        - Line ranges require filepath param
        - Files >512MB are rejected`,
    {
      text: z
        .string()
        .optional()
        .describe('Text to count tokens for'),
      filepath: z
        .string()
        .optional()
        .describe(
          'File path (mutually exclusive with text)',
        ),
      startLine: z
        .number()
        .optional()
        .describe(
          'Start line (1-based, inclusive, requires filepath param)',
        ),
      endLine: z
        .number()
        .optional()
        .describe(
          'End line (1-based, inclusive, defaults to EOF, requires filepath param)',
        ),
      lineRanges: z
        .array(
          z.object({
            startLine: z
              .number()
              .describe('Start line number (1-based, inclusive)'),
            endLine: z
              .number()
              .optional()
              .describe(
                'End line number (1-based, inclusive). Defaults to end of file.',
              ),
            description: z
              .string()
              .optional()
              .describe('Optional description for this range'),
          }),
        )
        .optional()
        .describe(
          'Multiple line ranges (mutually exclusive with startLine/endLine, requires filepath param)',
        ),
      model: z
        .string()
        .optional()
        .default(DEFAULT_TOKEN_COUNTING_MODEL)
        .describe(
          `Model for counting (default: ${DEFAULT_TOKEN_COUNTING_MODEL})`,
        ),
    },
    async ({
      text,
      filepath,
      startLine,
      endLine,
      lineRanges,
      model = DEFAULT_TOKEN_COUNTING_MODEL,
    }): Promise<CallToolResult> => {
      console.log(
        `[count_tokens] Tool called with text: ${text ? 'provided' : 'N/A'}, filepath: ${filepath || 'N/A'}, startLine: ${startLine || 'N/A'}, endLine: ${endLine || 'N/A'}, lineRanges: ${lineRanges ? `${lineRanges.length} ranges` : 'N/A'}, model: ${model}`,
      );

      try {
        // Validate parameters
        validateTokenCountingParams({ text, filepath, startLine, endLine, lineRanges });

        // Get content to count
        let contentToCount: string = '';
        let characterCount: number = 0;
        let source: 'direct_text' | 'file' | 'file_lines' | 'file_multiple_ranges';
        let linesProcessed: string | undefined;
        let fileSizeWarning: string | undefined;
        let rangeBreakdown: Array<{
          startLine: number;
          endLine: number;
          tokenCount: number;
          characterCount: number;
          description?: string;
        }> | undefined;
        let totalTokenCount = 0;
        let totalCharacterCount = 0;

        if (text !== undefined) {
          // Direct text input
          contentToCount = text;
          characterCount = text.length;
          source = 'direct_text';
          console.log(
            `[count_tokens] Using direct text, length: ${characterCount} characters`,
          );
        } else if (filepath && lineRanges && lineRanges.length > 0) {
          // Multiple ranges mode
          console.log(
            `[count_tokens] Processing ${lineRanges.length} line ranges`,
          );
          source = 'file_multiple_ranges';
          rangeBreakdown = [];

          for (let i = 0; i < lineRanges.length; i++) {
            const range = lineRanges[i];
            console.log(
              `[count_tokens] Processing range ${i + 1}: lines ${range.startLine}-${range.endLine || 'EOF'}`,
            );

            // Get content for this range
            const fileContent = await getFileContentForTokenCounting(
              filepath,
              range.startLine,
              range.endLine,
            );

            // Call API for this range
            const apiResponse = await callAnthropicTokenCountingAPI(
              fileContent.content,
              model,
            );

            // Extract actual end line from linesProcessed (format: "start-end")
            const actualEndLine = fileContent.linesProcessed
              ? parseInt(fileContent.linesProcessed.split('-')[1])
              : range.endLine || 0;

            // Store range result
            rangeBreakdown.push({
              startLine: range.startLine,
              endLine: actualEndLine,
              tokenCount: apiResponse.input_tokens,
              characterCount: fileContent.characterCount,
              description: range.description,
            });

            // Accumulate totals
            totalTokenCount += apiResponse.input_tokens;
            totalCharacterCount += fileContent.characterCount;

            // Store file size warning from first range (if any)
            if (i === 0 && fileContent.fileSizeWarning) {
              fileSizeWarning = fileContent.fileSizeWarning;
            }
          }

          console.log(
            `[count_tokens] Completed ${lineRanges.length} ranges: ${totalTokenCount} total tokens, ${totalCharacterCount} total characters`,
          );
        } else if (filepath) {
          // Single range or full file
          const fileContent = await getFileContentForTokenCounting(
            filepath,
            startLine,
            endLine,
          );
          contentToCount = fileContent.content;
          characterCount = fileContent.characterCount;
          linesProcessed = fileContent.linesProcessed;
          fileSizeWarning = fileContent.fileSizeWarning;
          source = linesProcessed ? 'file_lines' : 'file';
          console.log(
            `[count_tokens] Using file content, length: ${characterCount} characters`,
          );
        } else {
          // This should never happen due to validation, but TypeScript needs it
          throw new Error(
            'Either "text" or "filepath" parameter must be provided',
          );
        }

        // Call Anthropic API (only for non-multiple-ranges mode)
        let tokenCount = 0;
        if (source !== 'file_multiple_ranges') {
          console.log('[count_tokens] Calling Anthropic Token Counting API');
          const apiResponse =
            await callAnthropicTokenCountingAPI(contentToCount, model);
          tokenCount = apiResponse.input_tokens;
        } else {
          tokenCount = totalTokenCount;
          characterCount = totalCharacterCount;
        }

        // Format output
        let resultText = '**Token Counting Results:**\n\n';
        resultText += '**Tool Result Details:**\n';
        resultText += `- tokenCount: ${tokenCount}\n`;
        resultText += `- characterCount: ${characterCount}\n`;
        resultText += `- model: ${model}\n`;
        resultText += `- source: ${source}\n`;

        if (filepath) {
          resultText += `- filepath: ${filepath}\n`;
        }
        if (linesProcessed) {
          resultText += `- linesProcessed: ${linesProcessed}\n`;
        }
        if (fileSizeWarning) {
          resultText += `- fileSizeWarning: ${fileSizeWarning}\n`;
        }

        // Add range breakdown for multiple ranges
        if (rangeBreakdown) {
          resultText += `- rangeCount: ${rangeBreakdown.length}\n\n`;
          resultText += '**Range Breakdown:**\n';
          for (let i = 0; i < rangeBreakdown.length; i++) {
            const range = rangeBreakdown[i];
            resultText += `- Range ${i + 1} (lines ${range.startLine}-${range.endLine}): ${range.tokenCount} tokens, ${range.characterCount} characters\n`;
            if (range.description) {
              resultText += `  Description: ${range.description}\n`;
            }
          }
        }

        const result: CallToolResult = {
          content: [
            {
              type: 'text',
              text: resultText,
            },
          ],
        };

        console.log(
          `[count_tokens] Successfully completed: ${tokenCount} tokens for ${characterCount} characters`,
        );
        return result;
      } catch (error) {
        console.error('[count_tokens] Error in tool:', error);
        throw error;
      }
    },
  );
      }
