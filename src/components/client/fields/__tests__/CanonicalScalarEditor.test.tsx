/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CanonicalScalarEditor } from '../CanonicalScalarEditor';

describe('CanonicalScalarEditor - Component Tests', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('renders constrained Yes/No Select dropdown for BOOLEAN datatype (not free-text input)', () => {
        const onChange = vi.fn();
        render(
            <CanonicalScalarEditor
                dataType="BOOLEAN"
                value={true}
                onChange={onChange}
            />
        );

        // Should render a combobox/select trigger for Yes/No, NOT a text input
        const selectTrigger = screen.getByRole('combobox');
        expect(selectTrigger).toBeTruthy();
        expect(screen.queryByPlaceholderText('Enter value...')).toBeNull();
        expect(screen.queryByPlaceholderText('Type a value and press Enter...')).toBeNull();
    });

    it('renders HTML date picker input for DATE / DATETIME datatypes', () => {
        const onChange = vi.fn();
        const { container } = render(
            <CanonicalScalarEditor
                dataType="DATETIME"
                value="2026-08-24T00:00:00.000Z"
                onChange={onChange}
            />
        );

        const dateInput = container.querySelector('input[type="date"]');
        expect(dateInput).toBeTruthy();
        expect((dateInput as HTMLInputElement).value).toBe('2026-08-24');
    });

    it('renders Select dropdown when options array is provided', () => {
        const onChange = vi.fn();
        render(
            <CanonicalScalarEditor
                dataType="TEXT"
                options={['Option A', 'Option B']}
                value="Option A"
                onChange={onChange}
            />
        );

        const selectTrigger = screen.getByRole('combobox');
        expect(selectTrigger).toBeTruthy();
        expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('renders standard text input for TEXT / NUMBER / string datatypes', () => {
        const onChange = vi.fn();
        render(
            <CanonicalScalarEditor
                dataType="TEXT"
                value="Hello World"
                onChange={onChange}
                placeholder="Enter value..."
            />
        );

        const textInput = screen.getByPlaceholderText('Enter value...');
        expect(textInput).toBeTruthy();
        expect((textInput as HTMLInputElement).value).toBe('Hello World');
    });

    it('sanitizes explicitNone object sentinel as empty text input (never displays raw JSON sentinel)', () => {
        const onChange = vi.fn();
        render(
            <CanonicalScalarEditor
                dataType="TEXT"
                value={{ explicitNone: true }}
                onChange={onChange}
                placeholder="Enter value..."
            />
        );

        const textInput = screen.getByPlaceholderText('Enter value...');
        expect(textInput).toBeTruthy();
        expect((textInput as HTMLInputElement).value).toBe('');
        expect(screen.queryByDisplayValue('{"explicitNone":true}')).toBeNull();
    });

    it('sanitizes stringified explicitNone JSON sentinel as empty text input', () => {
        const onChange = vi.fn();
        render(
            <CanonicalScalarEditor
                dataType="TEXT"
                value='{"explicitNone":true}'
                onChange={onChange}
                placeholder="Enter value..."
            />
        );

        const textInput = screen.getByPlaceholderText('Enter value...');
        expect(textInput).toBeTruthy();
        expect((textInput as HTMLInputElement).value).toBe('');
        expect(screen.queryByDisplayValue('{"explicitNone":true}')).toBeNull();
    });

    it('sanitizes explicitNone sentinel when options array is provided (maps to empty selection)', () => {
        const onChange = vi.fn();
        render(
            <CanonicalScalarEditor
                dataType="TEXT"
                options={['Option A', 'Option B']}
                value={{ explicitNone: true }}
                onChange={onChange}
            />
        );

        const selectTrigger = screen.getByRole('combobox');
        expect(selectTrigger).toBeTruthy();
        expect(screen.queryByText('{"explicitNone":true}')).toBeNull();
    });

    it('renders a safe non-editable warning for unsupported complex datatypes (e.g. DOCUMENT)', () => {
        const onChange = vi.fn();
        render(
            <CanonicalScalarEditor
                dataType="UNSUPPORTED_TYPE"
                value={null}
                onChange={onChange}
            />
        );

        expect(screen.getByText(/Editing is not supported for field type "UNSUPPORTED_TYPE"/i)).toBeTruthy();
        expect(screen.queryByRole('textbox')).toBeNull();
        expect(screen.queryByRole('combobox')).toBeNull();
    });
});
