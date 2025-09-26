// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// Virtual document provider for MCP servers JSON
class McpServersContentProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;
  private content: string = "{}";

  provideTextDocumentContent(_uri: vscode.Uri): string {
    return this.content;
  }

  update(uri: vscode.Uri, content: string) {
    this.content = content;
    this._onDidChange.fire(uri);
  }
}

// Find all JSON files in the mcp_servers directory
async function findMcpServerJsonFiles(workspaceDir: string): Promise<string[]> {
  const mcpServersDir = path.join(workspaceDir, ".claude");
  // const mcpServersFilePath = path.join(workspaceDir, ".claude", "mcpServers.json");

  if (!fs.existsSync(mcpServersDir)) {
    return [];
  }
  const files = await fs.promises.readdir(mcpServersDir);
  return files
    .filter((file) => file.endsWith("mcpServers.json"))
    .map((file) => path.join(mcpServersDir, file));
}

// Read and parse JSON files
async function readJsonFiles(filePaths: string[]): Promise<any[]> {
  const jsonObjects = [];

  for (const filePath of filePaths) {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const parsed = JSON.parse(content);
      jsonObjects.push({ filePath, data: parsed });
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error);
    }
  }

  return jsonObjects;
}

// Collect and merge all mcpServers objects
function collectMcpServers(jsonObjects: any[]): Map<string, any> {
  const mcpServersMap = new Map<string, any>();

  for (const { data } of jsonObjects) {
    if (data.servers && typeof data.servers === "object") {
      for (const [serverName, serverConfig] of Object.entries(data.servers)) {
        // Store with unique key to handle potential duplicates
        mcpServersMap.set(serverName, serverConfig);
      }
    }
  }

  return mcpServersMap;
}

// Show multi-select quickpick for server selection
async function showServerQuickPick(
  mcpServersMap: Map<string, any>
): Promise<Map<string, any> | undefined> {
  const items: vscode.QuickPickItem[] = Array.from(mcpServersMap.entries()).map(
    ([name, config]) => ({
      label: name,
      description: `Command: ${config.command}`,
      detail: config.args ? `Args: ${config.args.join(" ")}` : undefined,
      picked: false,
    })
  );

  const selectedItems = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    placeHolder: "Select MCP servers to include",
    title: "MCP Server Selection",
  });

  if (!selectedItems || selectedItems.length === 0) {
    return undefined;
  }

  const selectedServers = new Map<string, any>();
  for (const item of selectedItems) {
    const serverConfig = mcpServersMap.get(item.label);
    if (serverConfig) {
      selectedServers.set(item.label, serverConfig);
    }
  }

  return selectedServers;
}

// Create temporary JSON file with selected servers
async function createTempJsonFile(
  selectedServers: Map<string, any>
): Promise<string> {
  const mcpServersObject = {
    mcpServers: Object.fromEntries(selectedServers),
  };

  const content = JSON.stringify(mcpServersObject, null, 2);
  const timestamp = new Date().getTime();
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `mcp-servers-${timestamp}.json`);

  await fs.promises.writeFile(tempFilePath, content, "utf-8");

  return tempFilePath;
}

// Main function to coordinate the workflow
export async function selectMcpServers(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("No workspace folder open");
    return undefined;
  }

  const workspaceDir = workspaceFolders[0].uri.fsPath;

  try {
    // 1. Find all JSON files
    const jsonFiles = await findMcpServerJsonFiles(workspaceDir);
    if (jsonFiles.length === 0) {
      vscode.window.showInformationMessage(
        "No JSON files found in mcp_servers directory"
      );
      return undefined;
    }

    // 2. Read all JSON files
    const jsonObjects = await readJsonFiles(jsonFiles);

    // 3. Collect and merge mcpServers objects
    const mcpServersMap = collectMcpServers(jsonObjects);
    if (mcpServersMap.size === 0) {
      vscode.window.showInformationMessage(
        "No mcpServers configurations found"
      );
      return undefined;
    }

    // 4. Show multi-select quickpick
    const selectedServers = await showServerQuickPick(mcpServersMap);
    if (!selectedServers) {
      return undefined;
    }

    // 5. Create temporary JSON file
    const tempFilePath = await createTempJsonFile(selectedServers);

    // 6. Return the file path
    return tempFilePath;
  } catch (error) {
    vscode.window.showErrorMessage(`Error processing MCP servers: ${error}`);
    return undefined;
  }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "claude-code-configured-vscode" is now active!'
  );

  // Register the virtual document provider
  const mcpServersProvider = new McpServersContentProvider();
  const providerRegistration =
    vscode.workspace.registerTextDocumentContentProvider(
      "mcpservers",
      mcpServersProvider
    );
  context.subscriptions.push(providerRegistration);

  // Store the provider in workspace state for access in other functions
  context.workspaceState.update("mcpServersProvider", mcpServersProvider);

  // Register the selectMcpServers command
  const selectMcpServersCommand = vscode.commands.registerCommand(
    "claude-code-configured.selectMcpServers",
    async () => {
      const tempFilePath = await selectMcpServers();
      if (tempFilePath) {
        // Open the temporary file
        const doc = await vscode.workspace.openTextDocument(tempFilePath);
        await vscode.window.showTextDocument(doc, { preview: false });
      }
    }
  );
  context.subscriptions.push(selectMcpServersCommand);

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "claude-code-configured.runClaudeCodeConfigured",
    async () => {
      const tempFilePath = await selectMcpServers();
      let command = "claude";
      if (tempFilePath) {
        // If a temp file was created, include it in the command
        command += ` --mcp-servers ${tempFilePath}`;
      }
      const terminal = vscode.window.createTerminal({
        name: `Claude Code Router`,
        location: { viewColumn: vscode.ViewColumn.Beside },
        iconPath: new vscode.ThemeIcon("claude-icon"),
      });
      terminal.sendText(command);
      terminal.show();
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
