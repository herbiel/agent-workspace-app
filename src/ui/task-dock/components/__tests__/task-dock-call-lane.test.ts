import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import TaskDockCallLane from '../task-dock-call-lane.vue';

function mountCallLane() {
	return mount(TaskDockCallLane, {
		global: {
			plugins: [
				createTestingPinia({
					stubActions: false,
				}),
			],
		},
	});
}

describe('task-dock-call-lane', () => {
	it('shows softphone status lane', () => {
		const wrapper = mountCallLane();
		expect(wrapper.text()).toContain('Softphone');
		expect(wrapper.text()).toMatch(/Offline|Online|Busy|Connecting/);
	});

	it('keeps softphone lane expanded and non-collapsible', () => {
		const wrapper = mountCallLane();
		const softphone = wrapper
			.findAll('.task-dock-item-wrapper')
			.find((item) => item.text().includes('Softphone'));

		expect(softphone?.classes()).toContain('task-dock-item-wrapper--expanded');
		expect(softphone?.classes()).not.toContain(
			'task-dock-item-wrapper--collapsible',
		);
	});
});
