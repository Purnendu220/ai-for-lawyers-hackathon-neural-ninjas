// Runs the Firebase CLI with settings the emulators need on slower machines. Used by the npm
// scripts instead of `VAR=value firebase ...`, which does not work in Windows shells.
import { spawn } from 'node:child_process';

// Loading the functions bundle the first time can take longer than the CLI's 10-second default.
process.env.FUNCTIONS_DISCOVERY_TIMEOUT ??= '60';

const args = process.argv.slice(2).map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg));
const child = spawn('firebase', args, { stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 1));
