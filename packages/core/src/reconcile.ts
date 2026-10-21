export interface RuleDesired {
  id: string;
  domain: string;
  upstream: { host: string; port: number };
  enabled: boolean;
}

export type Operation =
  | { op: "upsert"; rule: RuleDesired }
  | { op: "delete"; id: string };

export interface DesiredState {
  rules: RuleDesired[];
}

export interface CurrentState {
  rules: RuleDesired[];
}

export interface DeployedDelta {
  changed: boolean;
  ops: Operation[];
}

// Reconcile the desired state with the current state by computing the delta and applying necessary changes
export async function reconcile(
  desired: DesiredState,
  observe: () => Promise<DesiredState>,
  diff: (
    desired: DesiredState,
    current: CurrentState,
  ) => Promise<DeployedDelta>,
  apply: (delta: DeployedDelta) => Promise<void>, // provider.apply(delta)
): Promise<DeployedDelta> {
  const current = await observe();
  const delta = await diff(desired, current);
  if (delta.changed) {
    await apply(delta);
  }
  return delta;
}

export async function computeDelta(
  desired: DesiredState,
  current: CurrentState,
): Promise<DeployedDelta> {
  const ops: Operation[] = [];
  const liveRules = current.rules;
  const liveById = new Map(liveRules.map((r) => [r.id, r]));

  // 1. Every desired rule must exist live and match — else upsert it
  for (const rule of desired.rules) {
    const live = liveById.get(rule.id);
    const same = live && JSON.stringify(live) === JSON.stringify(rule); // TODO: Possibly replace with better comparison logic
    if (!same) ops.push({ op: "upsert", rule });
    liveById.delete(rule.id); // seen; no longer "extra"
  }

  // 2. Anything still left live but not desired — kill it
  for (const rule of liveById.values()) ops.push({ op: "delete", id: rule.id });

  return { changed: ops.length > 0, ops };
}
