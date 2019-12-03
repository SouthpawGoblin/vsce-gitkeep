"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const path_1 = require("path");
const fs = require("fs");
const ignore_1 = require("ignore");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!vscode.workspace.workspaceFolders) {
            return;
        }
        // read .gitignore to get ignored directories
        let ig = ignore_1.default();
        const folderUri = vscode.workspace.workspaceFolders[0].uri;
        const ignoreFileUri = folderUri.with({ path: path_1.posix.join(folderUri.path, '.gitignore') });
        if (fs.existsSync(ignoreFileUri.fsPath)) {
            const ignoreFile = yield vscode.workspace.fs.readFile(ignoreFileUri);
            ig = ignore_1.default().add(ignoreFile.toString());
        }
        // watch file system changes
        const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*', false, false, false);
        /**
         * 1. if it's .gitkeep created, return
         * 2. if ignored, return directly
         * 3. if directory created, add .gitkeep
         * 4. if .gitignore created, update ignore
         */
        fileWatcher.onDidCreate((e) => __awaiter(this, void 0, void 0, function* () {
            if (path_1.posix.basename(e.path) === '.gitkeep') {
                return;
            }
            if (ig.ignores(e.fsPath.replace(folderUri.fsPath, '').slice(1))) {
                return;
            }
            const gitkeepPath = e.with({ path: path_1.posix.join(path_1.posix.dirname(e.path), '.gitkeep') });
            if (fs.existsSync(gitkeepPath.fsPath)) {
                yield vscode.workspace.fs.delete(gitkeepPath);
            }
            const stat = yield vscode.workspace.fs.stat(e);
            if (stat.type === vscode.FileType.Directory) {
                yield addGitkeep(e.path);
            }
            else if (e.path.replace(folderUri.path, '') === '/.gitignore') {
                ig = yield updateIgnore(false);
            }
        }));
        /**
         * 1. if .gitignore changed, update ignore
         */
        fileWatcher.onDidChange((e) => __awaiter(this, void 0, void 0, function* () {
            if (e.path.replace(folderUri.path, '') === '/.gitignore') {
                ig = yield updateIgnore(false);
            }
        }));
        /**
         * 1. if parent directory ignored, return
         * 2. if parent directory is empty after deletion, add .gitkeep
         * 3. if .gitignore deleted, clear ignore
         */
        fileWatcher.onDidDelete((e) => __awaiter(this, void 0, void 0, function* () {
            const dir = path_1.posix.dirname(e.path);
            if (ig.ignores(e.fsPath.replace(folderUri.fsPath, '').slice(1))) {
                return;
            }
            const contents = yield vscode.workspace.fs.readDirectory(e.with({ path: dir }));
            if (contents.length === 0) {
                yield addGitkeep(dir);
            }
            else if (e.path.replace(folderUri.path, '') === '/.gitignore') {
                ig = yield updateIgnore(true);
            }
        }));
        context.subscriptions.push(fileWatcher);
        // The command has been defined in the package.json file
        // Now provide the implementation of the command with registerCommand
        // The commandId parameter must match the command field in package.json
        let disposable = vscode.commands.registerCommand('extension.gitkeepGen', () => {
            // The code you place here will be executed every time your command is executed
            // traverse workspace directories recursively and generate .gitkeep files if not ignored.
            directoryGen(folderUri);
            function directoryGen(uri) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (uri.fsPath !== folderUri.fsPath && ig.ignores(uri.fsPath.replace(folderUri.fsPath, '').slice(1))) {
                        return;
                    }
                    const contents = yield vscode.workspace.fs.readDirectory(uri);
                    if (contents.length === 0) {
                        yield addGitkeep(uri.path);
                    }
                    else {
                        contents.forEach(content => {
                            if (content[1] === vscode.FileType.Directory) {
                                directoryGen(uri.with({ path: path_1.posix.join(uri.path, content[0]) }));
                            }
                        });
                    }
                });
            }
        });
        context.subscriptions.push(disposable);
        function updateIgnore(clear) {
            return __awaiter(this, void 0, void 0, function* () {
                if (clear) {
                    return ignore_1.default();
                }
                else {
                    const ignoreUri = folderUri.with({ path: path_1.posix.join(folderUri.path, '.gitignore') });
                    const ignoreFile = yield vscode.workspace.fs.readFile(ignoreUri);
                    return ignore_1.default().add(ignoreFile.toString());
                }
            });
        }
        function addGitkeep(dirPath) {
            return __awaiter(this, void 0, void 0, function* () {
                vscode.workspace.fs.writeFile(folderUri.with({ path: path_1.posix.join(dirPath, '.gitkeep') }), new Uint8Array());
            });
        }
    });
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map