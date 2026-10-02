<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import UsersIcon from '@tabler/icons-svelte/icons/users';
	import SettingsIcon from '@tabler/icons-svelte/icons/settings';
	import DashboardIcon from '@tabler/icons-svelte/icons/dashboard';
	import InnerShadowTopIcon from '@tabler/icons-svelte/icons/inner-shadow-top';

	import NavUser from './nav-user.svelte';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const data = {
		navMain: [
			{
				title: 'Dashboard',
				url: resolve('/dashboard'),
				icon: DashboardIcon
			},
			{
				title: 'Users',
				url: resolve('/dashboard/users'),
				icon: UsersIcon
			},
			{
				title: 'Settings',
				url: resolve('/dashboard/settings'),
				icon: SettingsIcon
			}
		]
	};
</script>

<Sidebar.Root class="top-(--header-height) h-[calc(100svh-var(--header-height))]!">
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton>
					{#snippet child({ props })}
						<a href={resolve('/dashboard')} {...props}>
							<InnerShadowTopIcon class="size-5!" />
							<span class="text-base font-semibold">Sluice</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.Menu>
				{#each data.navMain as item (item.title)}
					<Sidebar.MenuItem class="flex items-center gap-2">
						<Sidebar.MenuButton
							data-active={page.url.pathname === item.url}
							class="min-w-8 text-primary-foreground duration-200 ease-linear hover:bg-primary/80 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground data-[active=true]:bg-primary"
							tooltipContent={item.title}
						>
							{#snippet child({ props })}
								<a href={item.url} {...props}>
									<item.icon />
									<span>{item.title}</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer>
		<NavUser />
	</Sidebar.Footer>
</Sidebar.Root>
