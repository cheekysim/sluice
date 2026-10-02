<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar/index.js';

	let { url, name }: { url: string; name: string } = $props();
</script>

<Avatar.Root>
	<Avatar.Image src={url} alt="User Avatar" />
	<Avatar.Fallback>{name.charAt(0)}</Avatar.Fallback>
</Avatar.Root>
