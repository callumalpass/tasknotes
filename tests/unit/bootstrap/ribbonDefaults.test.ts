import { applyNewInstallRibbonDefaults } from "../../../src/bootstrap/ribbonDefaults";

function fixture() {
	return { items: [
		{ id: "tasknotes:Create", hidden: false },
		{ id: "tasknotes:Tasks", hidden: false },
		{ id: "tasknotes:Calendar", hidden: false },
		{ id: "tasknotes:Pomodoro", hidden: false },
		{ id: "other:Feature", hidden: false },
	], onChange: jest.fn() };
}

it("hides only optional TaskNotes ribbon actions on a new install and saves through Obsidian", () => {
	const ribbon = fixture();
	applyNewInstallRibbonDefaults(ribbon, true, new Set(["tasknotes:Pomodoro"]));
	expect(ribbon.items.filter(item => item.hidden).map(item => item.id)).toEqual(["tasknotes:Pomodoro"]);
	expect(ribbon.onChange).toHaveBeenCalledWith(true);
});

it("never changes existing users' visibility preferences", () => {
	const ribbon = fixture();
	ribbon.items[0].hidden = true;
	const before = JSON.stringify(ribbon.items);
	applyNewInstallRibbonDefaults(ribbon, false, new Set(["tasknotes:Pomodoro"]));
	expect(JSON.stringify(ribbon.items)).toBe(before);
	expect(ribbon.onChange).not.toHaveBeenCalled();
});
