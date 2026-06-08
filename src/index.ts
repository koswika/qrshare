#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { getLocalIp } from './network';
import { printQRCode } from './qr';
import { startServer, FileItem } from './server';

function parseArgs(): { files: string[]; port: number; timeout: number | null } {
    const args = process.argv.slice(2);
    const files: string[] = [];
    let port = 8000;
    let timeout: number | null = null;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg) continue;
        if (arg === '--port') {
            const next = args[i + 1];
            if (next && !next.startsWith('--')) {
                const parsed = parseInt(next, 10);
                if (!isNaN(parsed)) port = parsed;
                i++;
            }
        } else if (arg === '--timeout') {
            const next = args[i + 1];
            if (next && !next.startsWith('--')) {
                const parsed = parseInt(next, 10);
                if (!isNaN(parsed)) timeout = parsed;
                i++;
            }
        } else if (!arg.startsWith('--')) {
            files.push(arg);
        }
    }
    return { files, port, timeout };
}

async function collectFiles(paths: string[]): Promise<FileItem[]> {
    const items: FileItem[] = [];
    for (const p of paths) {
        const resolved = path.resolve(p);
        if (!fs.existsSync(resolved)) {
            console.error(chalk.yellow(`Skipping ${p} – does not exist`));
            continue;
        }
        const stat = fs.statSync(resolved);
        if (stat.isFile()) {
            items.push({ name: path.basename(resolved), path: resolved, size: stat.size });
        } else if (stat.isDirectory()) {
            const dirFiles = fs.readdirSync(resolved);
            for (const file of dirFiles) {
                const full = path.join(resolved, file);
                const fstat = fs.statSync(full);
                if (fstat.isFile()) {
                    items.push({ name: file, path: full, size: fstat.size });
                }
            }
        }
    }
    return items;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function main() {
    const { files: filePaths, port, timeout } = parseArgs();

    if (filePaths.length === 0) {
        console.error(chalk.red('Usage: qrshare <file/folder> [--port PORT] [--timeout SECONDS]'));
        process.exit(1);
    }

    const files = await collectFiles(filePaths);
    if (files.length === 0) {
        console.error(chalk.red('No valid files found.'));
        process.exit(1);
    }

    const ip = getLocalIp();
    if (!ip) {
        console.error(chalk.red('Could not find local IP. Are you connected to a network?'));
        process.exit(1);
    }

    const url = `http://${ip}:${port}`;
    console.log(chalk.blue(`\nSharing ${chalk.bold(files.length.toString())} file(s):`));
    files.forEach(f => console.log(chalk.gray(`   ${f.name} (${formatBytes(f.size)})`)));

    const spinner = ora({ text: 'Starting server...', spinner: 'dots' }).start();

    const server = startServer({
        port,
        files,
        timeoutSeconds: timeout ?? undefined,
        onTimeout: () => {
            spinner.stop();
            console.log(chalk.red('\nTimeout reached. Server closed.'));
            process.exit(0);
        }
    });

    server.on('listening', () => {
        spinner.succeed(chalk.blue(`Server running at ${url}`));
        console.log(chalk.yellow('\nScan this QR code with your phone:\n'));
        printQRCode(url);
        console.log(chalk.gray(`\nOr open ${url} in your phone browser`));
        if (timeout) console.log(chalk.gray(`Auto-stop after ${timeout} seconds`));
        console.log(chalk.gray('Press Ctrl+C to stop manually'));
    });

    process.on('SIGINT', () => {
        spinner.stop();
        console.log(chalk.red('\nServer stopped by user'));
        server.close();
        process.exit(0);
    });
}

main();