import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';

export const activate = (context: vscode.ExtensionContext) => {
  vscode.languages.registerDocumentFormattingEditProvider(
    [
      { language: 'janet', scheme: 'file' },
      { language: 'janet', scheme: 'untitled' },
    ],
    new JanetFormatProvider(context),
  );
};

class JanetFormatProvider implements vscode.DocumentFormattingEditProvider {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  janetIsInstalled(): boolean {
    const cmd = spawn('which', ['janet']);
    return cmd.exitCode === 0;
  }

  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken,
  ): Thenable<vscode.TextEdit[]> {
    return new Promise((resolve, reject) => {
      if (!this.janetIsInstalled()) {
        vscode.window.showErrorMessage(
          "janet-formatter failed: janet doesn't appear to be installed",
        );
        reject();
        return;
      }

      const janetfmtPath = path.join(
        this.context.extensionPath,
        'bin',
        'janetfmt',
      );

      const cmd = spawn(janetfmtPath);
      const result: Buffer[] = [];
      const error: Buffer[] = [];

      cmd.stdout.on('data', (data) => {
        result.push(data);
      });

      cmd.stderr.on('data', (err) => {
        error.push(err);
      });

      cmd.on('exit', (code: number | null) => {
        const output = Buffer.concat(result).toString();

        if (output.length > 0) {
          const range = document.validateRange(
            new vscode.Range(0, 0, Infinity, Infinity),
          );
          resolve([new vscode.TextEdit(range, output)]);
        } else {
          const errorMsg = Buffer.concat(error).toString();
          vscode.window.showErrorMessage('janet-formatter ' + errorMsg);
          reject();
          return;
        }
      });

      cmd.stdin.write(document.getText());
      cmd.stdin.end();
    });
  }
}
