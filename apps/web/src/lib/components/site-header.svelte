<script lang="ts">
	import SidebarIcon from '@lucide/svelte/icons/sidebar';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	const sidebar = Sidebar.useSidebar();

	import { page } from '$app/state';

	import { titleCase } from '$lib/utils';

	function formatBreadcrumbItem(pathname: string) {
		const segments = pathname.split('/');

		// Replace UserID with Username
		return segments.slice(2).map(titleCase);
	}

	let breadcrumbItems = $derived(formatBreadcrumbItem(page.url.pathname));
</script>

<header class="sticky top-0 z-50 flex w-full items-center border-b bg-background">
	<div class="flex h-(--header-height) w-full items-center gap-2 px-4">
		<Button class="size-8" variant="ghost" size="icon" onclick={sidebar.toggle}>
			<SidebarIcon />
		</Button>
		<Separator orientation="vertical" class="me-2 data-vertical:h-4 data-vertical:self-auto" />
		<Breadcrumb.Root class="hidden sm:block">
			<Breadcrumb.List>
				<Breadcrumb.Item>
					<Breadcrumb.Link href="/dashboard">Dashboard</Breadcrumb.Link>
				</Breadcrumb.Item>
				{#each breadcrumbItems as item (item)}
					<Breadcrumb.Separator />
					<Breadcrumb.Item>
						<Breadcrumb.Page>{titleCase(item)}</Breadcrumb.Page>
					</Breadcrumb.Item>
				{/each}
			</Breadcrumb.List>
		</Breadcrumb.Root>
		<div class="w-full sm:ms-auto sm:w-auto">TODO</div>
	</div>
</header>
