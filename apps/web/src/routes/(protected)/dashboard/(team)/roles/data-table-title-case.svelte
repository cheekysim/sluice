<script lang="ts">
	import { titleCase } from '$lib/utils';

	let { text }: { text: string } = $props();
</script>

{titleCase(text)}
