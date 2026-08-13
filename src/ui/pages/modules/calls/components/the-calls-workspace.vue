<template>
	<section class="the-calls-workspace">
		<outbound-workbench />
	</section>
</template>

<script setup lang="ts">
import OutboundWorkbench from './outbound-workbench.vue';
</script>

<style scoped>
.the-calls-workspace {
	display: flex;
	flex: 1;
	min-height: 0;
	overflow: hidden;
}
</style>
