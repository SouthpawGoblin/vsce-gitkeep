// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { posix } from 'path';
import * as fs from 'fs';
import ignore, { Ignore } from 'ignore';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	if (!vscode.workspace.workspaceFolders) {
		return;
	}

	// read .gitignore to get ignored directories
	let ig = ignore();
	const folderUri = vscode.workspace.workspaceFolders[0].uri;
	const ignoreFileUri = folderUri.with({ path: posix.join(folderUri.path, '.gitignore') });
	if (fs.existsSync(ignoreFileUri.fsPath)) {
		const ignoreFile = await vscode.workspace.fs.readFile(ignoreFileUri);
		ig = ignore().add(ignoreFile.toString());
	}

	// watch file system changes
	const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*', false, false, false);

	/**
	 * 1. if it's .gitkeep created, return
	 * 2. if ignored, return directly
	 * 3. if directory created, add .gitkeep
	 * 4. if .gitignore created, update ignore
	 */
	fileWatcher.onDidCreate(async (e: vscode.Uri) => {
		if (posix.basename(e.path) === '.gitkeep') {
			return;
		}
		if (ig.ignores(e.fsPath.replace(folderUri.fsPath, '').slice(1))) {
			return;
		}
		const gitkeepPath = e.with({ path: posix.join(posix.dirname(e.path), '.gitkeep') });
		if (fs.existsSync(gitkeepPath.fsPath)) {
			await vscode.workspace.fs.delete(gitkeepPath);
		}
		const stat = await vscode.workspace.fs.stat(e);
		if (stat.type === vscode.FileType.Directory) {
			await addGitkeep(e.path);
		} else if (e.path.replace(folderUri.path, '') === '/.gitignore') {
			ig = await updateIgnore(false);
		}
	});

	/**
	 * 1. if .gitignore changed, update ignore
	 */
	fileWatcher.onDidChange(async (e: vscode.Uri) => {
		if (e.path.replace(folderUri.path, '') === '/.gitignore') {
			ig = await updateIgnore(false);
		}
	});

	/**
	 * 1. if parent directory ignored, return
	 * 2. if parent directory is empty after deletion, add .gitkeep
	 * 3. if .gitignore deleted, clear ignore
	 */
	fileWatcher.onDidDelete(async (e: vscode.Uri) => {
		const dir = posix.dirname(e.path);
		if (ig.ignores(e.fsPath.replace(folderUri.fsPath, '').slice(1))) {
			return;
		}
		const contents = await vscode.workspace.fs.readDirectory(e.with({ path: dir }));
		if (contents.length === 0) {
			await addGitkeep(dir);
		} else if (e.path.replace(folderUri.path, '') === '/.gitignore') {
			ig = await updateIgnore(true);
		}
	});

	context.subscriptions.push(fileWatcher);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.gitkeepGen', () => {
		// The code you place here will be executed every time your command is executed
		// traverse workspace directories recursively and generate .gitkeep files if not ignored.
		directoryGen(folderUri);

		async function directoryGen(uri: vscode.Uri) {
			if (uri.fsPath !== folderUri.fsPath && ig.ignores(uri.fsPath.replace(folderUri.fsPath, '').slice(1))) {
				return;
			}
			const contents = await vscode.workspace.fs.readDirectory(uri);
			if (contents.length === 0) {
				await addGitkeep(uri.path);
			} else {
				contents.forEach(content => {
					if (content[1] === vscode.FileType.Directory) {
						directoryGen(uri.with({ path: posix.join(uri.path, content[0]) }));
					}
				});
			}
		}
	});

	context.subscriptions.push(disposable);

	async function updateIgnore(clear: boolean): Promise<Ignore> {
		if (clear) {
			return ignore();
		} else {
			const ignoreUri = folderUri.with({ path: posix.join(folderUri.path, '.gitignore') });
			const ignoreFile = await vscode.workspace.fs.readFile(ignoreUri);
			return ignore().add(ignoreFile.toString());
		}
	}

	async function addGitkeep(dirPath: string) {
		vscode.workspace.fs.writeFile(folderUri.with({ path: posix.join(dirPath, '.gitkeep') }), new Uint8Array());
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}
