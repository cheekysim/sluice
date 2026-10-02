<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { titleCase } from '$lib/utils';

	let { badge }: { badge: string } = $props();
</script>

<Badge variant="secondary">{titleCase(badge)}</Badge>
