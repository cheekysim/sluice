export const RULE_PROVIDERS = [{ type: 'nginx', name: 'Nginx' }] as const;

export type RuleProviderType = (typeof RULE_PROVIDERS)[number]['type'];
