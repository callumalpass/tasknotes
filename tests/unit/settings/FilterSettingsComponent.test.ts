import { createFilterSettingsInputs } from '../../../src/settings/components/FilterSettingsComponent';
import type { FileFilterConfig } from '../../../src/suggest/FileSuggestHelper';
import type { TranslationKey } from '../../../src/i18n';

// Mock createCardInput
jest.mock('../../../src/settings/components/CardComponent', () => ({
	createCardInput: jest.fn((type: string, placeholder: string, value?: string) => {
		const input = document.createElement('input');
		input.type = type;
		input.placeholder = placeholder;
		if (value) input.value = value;
		return input;
	}),
}));

describe('FilterSettingsComponent', () => {
	let container: HTMLElement;
	let mockOnChange: jest.Mock;
	let mockTranslate: jest.Mock;

	beforeEach(() => {
		container = document.createElement('div');
		mockOnChange = jest.fn();
		mockTranslate = jest.fn((key: TranslationKey) => {
			// Return simplified translations for testing
			const translations: Record<string, string> = {
				'settings.appearance.projectAutosuggest.requiredTags.name': 'Required tags',
				'settings.appearance.projectAutosuggest.requiredTags.placeholder': 'tag1, tag2',
				'settings.appearance.projectAutosuggest.includeFolders.name': 'Include folders',
				'settings.appearance.projectAutosuggest.includeFolders.placeholder': 'folder1, folder2',
				'settings.appearance.projectAutosuggest.requiredPropertyKey.name': 'Required property key',
				'settings.appearance.projectAutosuggest.requiredPropertyKey.placeholder': 'property-key',
				'settings.appearance.projectAutosuggest.requiredPropertyValue.name': 'Required property value',
				'settings.appearance.projectAutosuggest.requiredPropertyValue.placeholder': 'property-value',
			};
			return translations[key] || key;
		});
	});

	describe('Component Creation', () => {
		it('should create filter settings inputs with empty config', () => {
			createFilterSettingsInputs(container, undefined, mockOnChange, mockTranslate);

			// Should create 4 rows (tags, folders, property key, property value)
			const rows = container.querySelectorAll('.tasknotes-settings__card-config-row');
			expect(rows.length).toBe(4);

			// Should create 4 inputs
			const inputs = container.querySelectorAll('input');
			expect(inputs.length).toBe(4);
		});

		it('should populate inputs with existing config values', () => {
			const config: FileFilterConfig = {
				requiredTags: ['person', 'team'],
				includeFolders: ['People/', 'Teams/'],
				propertyKey: 'role',
				propertyValue: 'developer',
			};

			createFilterSettingsInputs(container, config, mockOnChange, mockTranslate);

			const inputs = container.querySelectorAll('input');
			expect(inputs[0].value).toBe('person, team');
			expect(inputs[1].value).toBe('People/, Teams/');
			expect(inputs[2].value).toBe('role');
			expect(inputs[3].value).toBe('developer');
		});

		it('should handle partial config', () => {
			const config: FileFilterConfig = {
				requiredTags: ['project'],
			};

			createFilterSettingsInputs(container, config, mockOnChange, mockTranslate);

			const inputs = container.querySelectorAll('input');
			expect(inputs[0].value).toBe('project');
			expect(inputs[1].value).toBe('');
			expect(inputs[2].value).toBe('');
			expect(inputs[3].value).toBe('');
		});
	});

	describe('User Interactions', () => {
		it('should call onChange when tags input changes', () => {
			createFilterSettingsInputs(container, undefined, mockOnChange, mockTranslate);

			const tagsInput = container.querySelectorAll('input')[0];
			tagsInput.value = 'tag1, tag2';
			tagsInput.dispatchEvent(new Event('change'));

			expect(mockOnChange).toHaveBeenCalledWith(
				expect.objectContaining({
					requiredTags: ['tag1', 'tag2'],
				})
			);
		});

		it('should call onChange when folders input changes', () => {
			createFilterSettingsInputs(container, undefined, mockOnChange, mockTranslate);

			const foldersInput = container.querySelectorAll('input')[1];
			foldersInput.value = 'Projects/, Work/';
			foldersInput.dispatchEvent(new Event('change'));

			expect(mockOnChange).toHaveBeenCalledWith(
				expect.objectContaining({
					includeFolders: ['Projects/', 'Work/'],
				})
			);
		});

		it('should call onChange when property key changes', () => {
			createFilterSettingsInputs(container, undefined, mockOnChange, mockTranslate);

			const keyInput = container.querySelectorAll('input')[2];
			keyInput.value = 'type';
			keyInput.dispatchEvent(new Event('change'));

			expect(mockOnChange).toHaveBeenCalledWith(
				expect.objectContaining({
					propertyKey: 'type',
				})
			);
		});

		it('should call onChange when property value changes', () => {
			createFilterSettingsInputs(container, undefined, mockOnChange, mockTranslate);

			const valueInput = container.querySelectorAll('input')[3];
			valueInput.value = 'project';
			valueInput.dispatchEvent(new Event('change'));

			expect(mockOnChange).toHaveBeenCalledWith(
				expect.objectContaining({
					propertyValue: 'project',
				})
			);
		});

		it('should trim whitespace from comma-separated values', () => {
			createFilterSettingsInputs(container, undefined, mockOnChange, mockTranslate);

			const tagsInput = container.querySelectorAll('input')[0];
			tagsInput.value = ' tag1 , tag2 , tag3 ';
			tagsInput.dispatchEvent(new Event('change'));

			expect(mockOnChange).toHaveBeenCalledWith(
				expect.objectContaining({
					requiredTags: ['tag1', 'tag2', 'tag3'],
				})
			);
		});

		it('should filter out empty values from comma-separated lists', () => {
			createFilterSettingsInputs(container, undefined, mockOnChange, mockTranslate);

			const tagsInput = container.querySelectorAll('input')[0];
			tagsInput.value = 'tag1, , tag2, ,';
			tagsInput.dispatchEvent(new Event('change'));

			expect(mockOnChange).toHaveBeenCalledWith(
				expect.objectContaining({
					requiredTags: ['tag1', 'tag2'],
				})
			);
		});

		it('should handle empty input by creating empty array', () => {
			createFilterSettingsInputs(container, undefined, mockOnChange, mockTranslate);

			const tagsInput = container.querySelectorAll('input')[0];
			tagsInput.value = '';
			tagsInput.dispatchEvent(new Event('change'));

			expect(mockOnChange).toHaveBeenCalledWith(
				expect.objectContaining({
					requiredTags: [],
				})
			);
		});
	});

	describe('Config Merging', () => {
		it('should preserve existing config values when updating one field', () => {
			const initialConfig: FileFilterConfig = {
				requiredTags: ['existing-tag'],
				includeFolders: ['existing-folder'],
				propertyKey: 'existing-key',
				propertyValue: 'existing-value',
			};

			createFilterSettingsInputs(container, initialConfig, mockOnChange, mockTranslate);

			// Change only the tags
			const tagsInput = container.querySelectorAll('input')[0];
			tagsInput.value = 'new-tag';
			tagsInput.dispatchEvent(new Event('change'));

			// Should preserve other fields
			expect(mockOnChange).toHaveBeenCalledWith({
				requiredTags: ['new-tag'],
				includeFolders: ['existing-folder'],
				propertyKey: 'existing-key',
				propertyValue: 'existing-value',
			});
		});
	});

	describe('Translation Keys', () => {
		it('should call translate for all label keys', () => {
			createFilterSettingsInputs(container, undefined, mockOnChange, mockTranslate);

			// Should translate 4 labels + 4 placeholders = 8 calls
			expect(mockTranslate).toHaveBeenCalledTimes(8);
			expect(mockTranslate).toHaveBeenCalledWith(
				'settings.appearance.projectAutosuggest.requiredTags.name'
			);
			expect(mockTranslate).toHaveBeenCalledWith(
				'settings.appearance.projectAutosuggest.includeFolders.name'
			);
			expect(mockTranslate).toHaveBeenCalledWith(
				'settings.appearance.projectAutosuggest.requiredPropertyKey.name'
			);
			expect(mockTranslate).toHaveBeenCalledWith(
				'settings.appearance.projectAutosuggest.requiredPropertyValue.name'
			);
		});
	});

	describe('Edge Cases', () => {
		it('should handle undefined config gracefully', () => {
			expect(() => {
				createFilterSettingsInputs(container, undefined, mockOnChange, mockTranslate);
			}).not.toThrow();
		});

		it('should handle config with undefined fields', () => {
			const config: FileFilterConfig = {
				requiredTags: undefined,
				includeFolders: undefined,
				propertyKey: undefined,
				propertyValue: undefined,
			};

			expect(() => {
				createFilterSettingsInputs(container, config, mockOnChange, mockTranslate);
			}).not.toThrow();
		});

		it('should trim property key and value', () => {
			createFilterSettingsInputs(container, undefined, mockOnChange, mockTranslate);

			const keyInput = container.querySelectorAll('input')[2];
			keyInput.value = '  type  ';
			keyInput.dispatchEvent(new Event('change'));

			expect(mockOnChange).toHaveBeenCalledWith(
				expect.objectContaining({
					propertyKey: 'type',
				})
			);
		});
	});
});

