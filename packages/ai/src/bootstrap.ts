/**
 * @fileoverview Lightweight bootstrap entrypoint for side-effect registration.
 *
 * Importing this module registers built-in tools and skills without pulling the
 * full @requiem/ai public surface (which includes optional subsystems).
 */

import './tools/builtins/system.echo';
import './tools/builtins/system.health';
import './tools/builtins/fs.read_file.js';
import './tools/builtins/fs.write_file.js';
import './tools/builtins/fs.list_dir.js';
import './tools/builtins/fs.diff_file.js';
import './tools/builtins/web.fetch';
import './tools/builtins/vector.search';
import './tools/builtins/vector.upsert';
import './tools/builtins/kilo.execute';
import './skills/baseline.js';
