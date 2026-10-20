<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import UsersIcon from '@tabler/icons-svelte/icons/users';
	import ShieldIcon from '@tabler/icons-svelte/icons/shield';
	import MailIcon from '@tabler/icons-svelte/icons/mail';
	import PlugConnectedIcon from '@tabler/icons-svelte/icons/plug-connected';
	import ServerIcon from '@tabler/icons-svelte/icons/server';
	import PuzzleIcon from '@tabler/icons-svelte/icons/puzzle';
	import SettingsIcon from '@tabler/icons-svelte/icons/settings';
	import DashboardIcon from '@tabler/icons-svelte/icons/dashboard';
	import InnerShadowTopIcon from '@tabler/icons-svelte/icons/inner-shadow-top';

	import NavUser from './nav-user.svelte';

	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { page } from '$app/state';

	type NavItem = {
		title: string;
		url: Pathname;
		icon?: typeof DashboardIcon;
		permission?: string;
	};
	type NavSection = { label?: string; items: NavItem[]; class?: string };

	const sections: NavSection[] = [
		{
			items: [{ title: 'Dashboard', url: '/dashboard', icon: DashboardIcon }]
		},
		{
			label: 'Team',
			items: [
				{
					title: 'Users',
					url: '/dashboard/users',
					icon: UsersIcon,
					permission: 'users.manage'
				},
				{
					title: 'Roles',
					url: '/dashboard/roles',
					icon: ShieldIcon,
					permission: 'roles.manage'
				},
				{
					title: 'Invites',
					url: '/dashboard/invites',
					icon: MailIcon,
					permission: 'users.manage'
				}
			]
		},
		{
			label: 'Infrastructure',
			items: [
				{
					title: 'Providers',
					url: '/dashboard/providers',
					icon: PlugConnectedIcon,
					permission: 'providers.read'
				},
				{
					title: 'Nodes',
					url: '/dashboard/nodes',
					icon: ServerIcon,
					permission: 'nodes.read'
				},
				{
					title: 'Plugins',
					url: '/dashboard/plugins',
					icon: PuzzleIcon,
					permission: 'plugins.read'
				}
			]
		},
		{
			// Pinned to the bottom of the sidebar content, like dashboard-01's secondary nav.
			class: 'mt-auto',
			items: [{ title: 'Settings', url: '/dashboard/settings', icon: SettingsIcon }]
		}
	];

	// Hide items the user can't use, then drop any section left empty.
	const visibleSections = $derived(
		sections
			.map((section) => ({
				...section,
				items: section.items.filter(
					(item) => !item.permission || page.data.userPermissions?.includes(item.permission)
				)
			}))
			.filter((section) => section.items.length > 0)
	);
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
		{#each visibleSections as section (section.label ?? section.items[0].title)}
			<Sidebar.Group class={section.class}>
				{#if section.label}
					<Sidebar.GroupLabel class="text-primary-foreground/60">{section.label}</Sidebar.GroupLabel
					>
				{/if}
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each section.items as item (item.url)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									data-active={page.url.pathname === resolve(item.url)}
									class="min-w-8 text-primary-foreground/90 duration-200 ease-linear hover:bg-primary/60 hover:text-primary-foreground data-[active=true]:bg-primary"
									tooltipContent={item.title}
								>
									{#snippet child({ props })}
										<a href={resolve(item.url)} {...props}>
											{#if item.icon}<item.icon />{/if}
											<span>{item.title}</span>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/each}
	</Sidebar.Content>

	<Sidebar.Footer>
		<NavUser />
	</Sidebar.Footer>
</Sidebar.Root>
