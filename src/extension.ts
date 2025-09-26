// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

// add a function that looks for an reads from a directory in the workspace called mcp_servers
async function readMcpServersDirectory() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("No workspace folder is open.");
    return [];
  }

  const mcpServersPath = vscode.Uri.joinPath(
    workspaceFolders[0].uri,
    "mcp_servers"
  );
  try {
    const files = await vscode.workspace.fs.readDirectory(mcpServersPath);
    return files
      .filter(([name, type]) => type === vscode.FileType.File)
      .map(([name]) => name);
  } catch (error) {
    vscode.window.showErrorMessage("Could not read mcp_servers directory.");
    return [];
  }
}

// example server file contents:
// {
// 	"mcpServers": {
// 		"server-1": {
// 			"args": ["args"],
// 			"command": "command"
// 		},
// 		"server-2": {
// 			"args": ["args"],
// 			"command": "command"
// 		}
// 	}
// }

// write a function that reads a specific mcp server config file from the mcp_servers directory and returns the parsed JSON listing individual servers

async function readMcpServerConfigs() {
  const servers = await readMcpServersDirectory();
  const configs = await Promise.all(
    servers.map(async (server) => {
      return readMcpServerConfig(server);
    })
  );
  return configs.filter((config) => config !== null);
}

async function readMcpServerConfig(serverFileName: string) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("No workspace folder is open.");
    return null;
  }

  const serverFilePath = vscode.Uri.joinPath(
    workspaceFolders[0].uri,
    "mcp_servers",
    serverFileName
  );

  try {
    const content = await vscode.workspace.fs.readFile(serverFilePath);
    return JSON.parse(content.toString());
  } catch (error) {
    vscode.window.showErrorMessage("Could not read MCP server config.");
    return null;
  }
}

// add a function that shows a quick pick of the mcp servers in the workspace
async function pickMcpServer() {
  const serverConfigs = await readMcpServerConfigs();
  if (serverConfigs.length === 0) {
    vscode.window.showErrorMessage("No MCP server configs found.");
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    serverConfigs.map(({ server }) => server),
    {
      placeHolder: "Select an MCP server",
    }
  );
  return picked;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "claude-code-router-vscode" is now active!'
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "claude-code-router.runCcrCode",
    async () => {
      const input = await vscode.window.showInputBox({
        prompt: "What is your command?",
        placeHolder: "e.g., --dangerously-skip-permissions",
      });
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage("No workspace folder is open.");
        return;
      }
      const mcpServersPath = vscode.Uri.joinPath(
        workspaceFolders[0].uri,
        "mcp_servers"
      );

      const pickedServer = await pickMcpServer();

      const pickedServerPath = pickedServer
        ? vscode.Uri.joinPath(mcpServersPath, pickedServer)
        : undefined; // currently not used, but could be in the future
      // The code you place here will be executed every time your command is executed
      const terminal = vscode.window.createTerminal({
        name: `Claude Code Router`,
        location: { viewColumn: vscode.ViewColumn.Beside },
      });
      terminal.sendText(
        `claude ${input} --mcp-config ${pickedServerPath?.fsPath}`
      );
      terminal.show();
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
