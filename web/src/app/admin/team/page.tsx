'use client';

import { motion } from 'framer-motion';
import { Ban, Check, Minus, Pause, Play, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Guarded, PageHeader, Panel } from '@/components/admin/Guard';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { cn, initials } from '@/lib/format';
import { ASSIGNABLE, can, isFarmRole, PERM_ROWS, PERMS, ROLE_INFO, ROLE_ORDER } from '@/lib/roles';
import { canManageMember } from '@/lib/stats';
import { useDB, useScope, useToast } from '@/lib/store';
import type { MemberStatus, Role, TeamMember } from '@/lib/types';

const STATUS: Record<MemberStatus, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-leaf-soft text-leaf-deep' },
  invited: { label: 'Invited', cls: 'bg-sun-soft text-[#8A5A00]' },
  suspended: { label: 'Paused', cls: 'bg-[#FFEBEE] text-[#B71C1C]' },
};

function Team() {
  const { me, farmId, suppliers, team } = useScope();
  const inviteMember = useDB((s) => s.inviteMember);
  const setMemberStatus = useDB((s) => s.setMemberStatus);
  const push = useToast((s) => s.push);

  const [inviting, setInviting] = useState(false);
  const [pause, setPause] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<{ name: string; email: string; role: Role; supplierId: string }>({ name: '', email: '', role: 'supplier_staff', supplierId: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const groups = useMemo(() => {
    const out: { title: string; members: TeamMember[] }[] = [];
    const platform = team.filter((t) => !t.supplierId);
    if (platform.length) out.push({ title: 'Saplaya team', members: platform });
    suppliers.forEach((s) => {
      const m = team.filter((t) => t.supplierId === s.id);
      if (m.length) out.push({ title: farmId ? 'Your farm team' : s.name, members: m });
    });
    return out;
  }, [team, suppliers, farmId]);

  if (!me) return null;
  const canInvite = can(me.role, 'team.manage');
  const options = ASSIGNABLE[me.role];

  function openInvite() {
    setForm({ name: '', email: '', role: options[0] ?? 'supplier_staff', supplierId: me?.supplierId ?? suppliers[0]?.id ?? '' });
    setErrors({});
    setInviting(true);
  }

  async function send() {
    const err: Record<string, string> = {};
    if (form.name.trim().length < 2) err.name = 'Enter their name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) err.email = 'Check the email address.';
    const farmRole = isFarmRole(form.role);
    if (farmRole && !form.supplierId) err.supplierId = 'Choose a farm.';
    setErrors(err);
    if (Object.keys(err).length) return;
    const problem = await inviteMember({ name: form.name.trim(), email: form.email, role: form.role, supplierId: farmRole ? (me?.supplierId ?? form.supplierId) : null });
    if (problem) { setErrors({ email: problem }); return; }
    push(`Invitation sent to ${form.email.trim()}. They join as ${ROLE_INFO[form.role].label}.`);
    setInviting(false);
  }

  async function resumeMember(member: TeamMember) {
    try {
      await setMemberStatus(member.id, 'active');
      push(`${member.name} can sign in again.`);
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not update this team member.', 'bad');
    }
  }

  async function pauseMember() {
    if (!pause) return;
    try {
      await setMemberStatus(pause.id, 'suspended');
      push(`${pause.name} is paused.`, 'info');
      setPause(null);
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not pause this team member.', 'bad');
    }
  }

  const set = (k: 'name' | 'email') => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader
        title="Team and roles"
        subtitle={farmId ? 'Add packers to your farm. Each person only does what their role allows.' : 'Everyone who works with Saplaya, and exactly what each role is allowed to do.'}
        actions={canInvite ? <Button icon={<UserPlus size={20} />} onClick={openInvite}>Invite someone</Button> : undefined}
      />

      <div className="space-y-6">
        {groups.map((g) => (
          <Panel key={g.title} title={g.title}>
            <ul className="divide-y divide-line">
              {g.members.map((m, i) => {
                const info = ROLE_INFO[m.role];
                const st = STATUS[m.status];
                const manage = canManageMember(me, m);
                return (
                  <motion.li key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-leaf-soft font-extrabold text-leaf-deep">{initials(m.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{m.name}{m.id === me.id && <span className="ml-2 text-sm font-semibold text-ink-mute">(you)</span>}</p>
                      <p className="truncate text-sm text-ink-mute">{m.email}</p>
                    </div>
                    <span className={cn('rounded-full px-3 py-1 text-sm font-bold', info.badge)}>{info.label}</span>
                    <span className={cn('rounded-full px-3 py-1 text-sm font-bold', st.cls)}>{st.label}</span>
                    {manage && (
                      <Button size="sm" variant={m.status === 'suspended' ? 'soft' : 'ghost'} icon={m.status === 'suspended' ? <Play size={16} /> : <Pause size={16} />} onClick={() => (m.status === 'suspended' ? void resumeMember(m) : setPause(m))}>
                        {m.status === 'suspended' ? 'Turn back on' : 'Pause'}
                      </Button>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          </Panel>
        ))}

        <Panel title="What each role can do" subtitle="The system enforces this. It is not only hidden buttons.">
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white p-3" />
                  {ROLE_ORDER.map((r) => (
                    <th key={r} className="p-3 text-center align-bottom">
                      <span className={cn('inline-block rounded-full px-3 py-1 text-sm font-bold', ROLE_INFO[r].badge, r === me.role && 'ring-2 ring-ink ring-offset-2')}>{ROLE_INFO[r].label}</span>
                      <span className="mt-1 block text-xs font-medium text-ink-mute">{ROLE_INFO[r].scope}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERM_ROWS.map((row) => (
                  <tr key={row.perm} className="group">
                    <td className="sticky left-0 border-t border-line bg-white p-3 font-semibold">{row.label}</td>
                    {ROLE_ORDER.map((r) => (
                      <td key={r} className="border-t border-line p-3 text-center">
                        {PERMS[r].includes(row.perm)
                          ? <span className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-leaf text-white"><Check size={17} strokeWidth={3} /></span>
                          : <span className="mx-auto grid h-8 w-8 place-items-center rounded-full text-ink-mute/60"><Minus size={17} /></span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Limits that always apply">
          <ul className="grid gap-3 md:grid-cols-2">
            {[
              'A farm can never see another farm’s orders, products, stock or team.',
              'Farms see a customer’s first name and delivery area only. Drivers and the Saplaya team see the phone number.',
              'Nobody can give someone a role above their own. Farm owners can only add farm packers.',
              'Even the Saplaya Owner cannot change a farm’s prices or stock. Farms control their own.',
              'Pausing a person or a farm blocks sign in straight away. Past orders and stock history stay.',
              'Every stock change is written to the stock history with who did it.',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 rounded-2xl bg-milk p-4 text-[15px]">
                <Ban size={18} className="mt-0.5 shrink-0 text-sun-deep" />{t}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Modal open={inviting} onClose={() => setInviting(false)} title="Invite someone">
        <div className="space-y-4">
          <Field label="Full name" error={errors.name}><Input value={form.name} onChange={set('name')} /></Field>
          <Field label="Email" error={errors.email} hint="They get a link to set up their sign in."><Input type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
              {options.map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
            </Select>
          </Field>
          {!farmId && isFarmRole(form.role) && (
            <Field label="Which farm?" error={errors.supplierId}>
              <Select value={form.supplierId} onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          )}
          <div className="rounded-2xl bg-milk p-4 text-[15px]">
            <p className="font-bold">{ROLE_INFO[form.role].label}</p>
            <p className="mt-1 text-ink-soft">{ROLE_INFO[form.role].blurb}</p>
            <p className="mt-2 font-semibold text-ink-soft">They cannot:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-soft">{ROLE_INFO[form.role].cannot.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setInviting(false)}>Cancel</Button><Button onClick={send}>Send invitation</Button></div>
        </div>
      </Modal>

      <Modal open={!!pause} onClose={() => setPause(null)} title="Pause this person?">
        {pause && (
          <div className="space-y-4">
            <p className="text-lg text-ink-soft"><b className="text-ink">{pause.name}</b> will not be able to sign in until you turn them back on. Their past work stays in the history.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPause(null)}>Not now</Button>
              <Button variant="danger" onClick={() => { void pauseMember(); }}>Yes, pause</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function TeamPage() {
  return (
    <Guarded perm="team.view">
      <Team />
    </Guarded>
  );
}
