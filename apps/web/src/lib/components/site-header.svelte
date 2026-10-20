<script lang="ts">
	import SidebarIcon from '@lucide/svelte/icons/sidebar';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	const sidebar = Sidebar.useSidebar();

	import { page } from '$app/state';

	import { titleCase } from '$lib/utils';

	function formatBreadcrumbItem(pathname: string, label?: string) {
		const segments = pathname.split('/').slice(1);

		return segments.map((segment, index) => ({
			// Detail pages supply a `breadcrumb` (e.g. a user's name) to replace their id segment
			text: index === segments.length - 1 && label ? label : titleCase(segment),
			href: `/${segments.slice(0, index + 1).join('/')}`
		}));
	}

	let breadcrumbItems = $derived(formatBreadcrumbItem(page.url.pathname, page.data.breadcrumb));
</script>

<header class="sticky top-0 z-50 flex w-full items-center border-b bg-background">
	<div class="flex h-(--header-height) w-full items-center gap-2 px-4">
		<Button class="size-8" variant="ghost" size="icon" onclick={sidebar.toggle}>
			<SidebarIcon />
		</Button>
		<Separator orientation="vertical" class="me-2 data-vertical:h-4 data-vertical:self-auto" />
		<Breadcrumb.Root class="hidden sm:block">
			<Breadcrumb.List>
				<!-- Links for previous items -->
				{#each breadcrumbItems.slice(0, -1) as item (item)}
					<Breadcrumb.Item>
						<Breadcrumb.Link href={item.href}>{item.text}</Breadcrumb.Link>
					</Breadcrumb.Item>
					<Breadcrumb.Separator />
				{/each}
				<!-- Active final item -->
				<Breadcrumb.Item>
					<Breadcrumb.Page>{breadcrumbItems[breadcrumbItems.length - 1].text}</Breadcrumb.Page>
				</Breadcrumb.Item>
			</Breadcrumb.List>
		</Breadcrumb.Root>
		<div class="w-full sm:ms-auto sm:w-auto">TODO</div>
	</div>
</header>
