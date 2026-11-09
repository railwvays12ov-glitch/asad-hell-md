// Command registry: sab commands yahan register hoti hain
export const commands = new Map();

/**
 * cmd(['name', 'alias'], { cat, desc, owner, group, admin }, async (ctx) => {})
 */
export function cmd(names, opts, run) {
  const list = Array.isArray(names) ? names : [names];
  const entry = {
    name: list[0],
    aliases: list.slice(1),
    desc: opts.desc || '',
    cat: opts.cat || 'General',
    owner: !!opts.owner,
    group: !!opts.group,
    admin: !!opts.admin,
    run,
  };
  for (const n of list) commands.set(n, entry);
}
