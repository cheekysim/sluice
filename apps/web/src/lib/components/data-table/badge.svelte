<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { titleCase } from '$lib/utils';

	let { badge, capitalize = true }: { badge: string; capitalize?: boolean } = $props();
</script>

<Badge variant="secondary">{capitalize ? titleCase(badge) : badge}</Badge>
