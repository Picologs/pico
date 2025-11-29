<script lang="ts">
	import { DashboardPage } from '@pico/shared';
	import fleetData from '@pico/shared/data/fleet.json';

	// Cast fleet data to satisfy type checker
	const dashboardProps: any = { fleet: fleetData };
</script>

<DashboardPage {...dashboardProps} />
