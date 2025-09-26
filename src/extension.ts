import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

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

async function findMcpServerJsonFiles(workspaceDir: string): Promise<string[]> {
  const mcpServersDir = path.join(workspaceDir, ".claude");

  if (!fs.existsSync(mcpServersDir)) {
    return [];
  }
  const files = await fs.promises.readdir(mcpServersDir);
  return files
    .filter((file) => file.endsWith("mcpServers.json"))
    .map((file) => path.join(mcpServersDir, file));
}

async function readJsonFiles(filePaths: string[]): Promise<any[]> {
  const jsonObjects = [];

  for (const filePath of filePaths) {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const parsed = JSON.parse(content);
      jsonObjects.push({ filePath, data: parsed });
    } catch (error) {}
  }

  return jsonObjects;
}

function collectMcpServers(jsonObjects: any[]): Map<string, any> {
  const mcpServersMap = new Map<string, any>();

  for (const { data } of jsonObjects) {
    if (data.mcpServers && typeof data.mcpServers === "object") {
      for (const [serverName, serverConfig] of Object.entries(
        data.mcpServers
      )) {
        mcpServersMap.set(serverName, serverConfig);
      }
    }
  }

  return mcpServersMap;
}

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
    ignoreFocusOut: true,
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

export async function selectMcpServers(
  defaultMcpServersPath?: string
): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("No workspace folder open");
    return undefined;
  }

  const workspaceDir = workspaceFolders[0].uri.fsPath;

  try {
    const jsonFiles = defaultMcpServersPath
      ? [defaultMcpServersPath]
      : await findMcpServerJsonFiles(workspaceDir);

    if (jsonFiles.length === 0) {
      vscode.window.showInformationMessage(
        "No JSON files found in mcp_servers directory"
      );
      return undefined;
    }

    const jsonObjects = await readJsonFiles(jsonFiles);
    console.info("🚀 ~ selectMcpServers ~ jsonObjects:", jsonObjects);

    const mcpServersMap = collectMcpServers(jsonObjects);
    console.info("🚀 ~ selectMcpServers ~ mcpServersMap:", mcpServersMap);
    if (mcpServersMap.size === 0) {
      vscode.window.showInformationMessage(
        "No mcpServers configurations found"
      );
      return undefined;
    }

    const selectedServers = await showServerQuickPick(mcpServersMap);
    if (!selectedServers) {
      return undefined;
    }

    const tempFilePath = await createTempJsonFile(selectedServers);

    return tempFilePath;
  } catch (error) {
    vscode.window.showErrorMessage(`Error processing MCP servers: ${error}`);
    return undefined;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "claude-code-configured-vscode" is now active!'
  );

  const config = vscode.workspace.getConfiguration("claude-code-configured");
  const defaultMcpServersPath = config.get<string>("mcpServersFilePath");

  const mcpServersProvider = new McpServersContentProvider();
  const providerRegistration =
    vscode.workspace.registerTextDocumentContentProvider(
      "mcpservers",
      mcpServersProvider
    );
  context.subscriptions.push(providerRegistration);

  context.workspaceState.update("mcpServersProvider", mcpServersProvider);

  const selectMcpServersCommand = vscode.commands.registerCommand(
    "claude-code-configured.selectMcpServers",
    async () => {
      const tempFilePath = await selectMcpServers(defaultMcpServersPath || "");
      if (tempFilePath) {
        const doc = await vscode.workspace.openTextDocument(tempFilePath);
        await vscode.window.showTextDocument(doc, { preview: false });
      }
    }
  );
  context.subscriptions.push(selectMcpServersCommand);

  const disposable = vscode.commands.registerCommand(
    "claude-code-configured.runClaudeCodeConfigured",
    async () => {
      const tempFilePath = await selectMcpServers(defaultMcpServersPath || "");
      let command = "claude";
      if (tempFilePath) {
        command += ` --mcp-config ${tempFilePath}`;
      }
      const terminal = vscode.window.createTerminal({
        name: `Claude Code`,
        location: { viewColumn: vscode.ViewColumn.Beside },
        iconPath: new vscode.ThemeIcon("claude-icon"),
      });
      terminal.sendText(command);
      terminal.show();
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
