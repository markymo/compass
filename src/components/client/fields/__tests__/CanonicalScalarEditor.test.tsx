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

    it('renders searchable combobox when options array is provided', () => {
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

    describe('ONP-191 - Option Set Searchable Combobox Regressions', () => {
        const sampleOptions = [
            { value: 'USD', label: 'US Dollar' },
            { value: 'EUR', label: 'Euro' },
            { value: 'GBP', label: 'British Pound' }
        ];

        it('renders a non-submitting combobox trigger button (type="button") for option-backed fields', () => {
            const onChange = vi.fn();
            const onSubmit = vi.fn((e) => e.preventDefault());

            render(
                <form onSubmit={onSubmit}>
                    <CanonicalScalarEditor
                        dataType="SELECT"
                        options={sampleOptions}
                        value="USD"
                        onChange={onChange}
                    />
                </form>
            );

            const trigger = screen.getByRole('combobox');
            expect(trigger).toBeTruthy();
            expect(trigger.getAttribute('type')).toBe('button');

            // Clicking the trigger must not submit the surrounding form
            fireEvent.click(trigger);
            expect(onSubmit).not.toHaveBeenCalled();
        });

        it('opens a search input and allows filtering by canonical value (e.g. USD)', () => {
            const onChange = vi.fn();
            render(
                <CanonicalScalarEditor
                    dataType="SELECT"
                    options={sampleOptions}
                    value=""
                    onChange={onChange}
                />
            );

            const trigger = screen.getByRole('combobox');
            fireEvent.click(trigger);

            // Expect search input to be present
            const searchInput = screen.getByPlaceholderText(/search/i);
            expect(searchInput).toBeTruthy();

            // Type canonical value "USD"
            fireEvent.change(searchInput, { target: { value: 'USD' } });

            // US Dollar should remain visible, while Euro and British Pound are not
            expect(screen.getByText('US Dollar')).toBeTruthy();
            expect(screen.queryByText('Euro')).toBeNull();
            expect(screen.queryByText('British Pound')).toBeNull();
        });

        it('allows filtering by human-readable label (e.g. Dollar) and emits exact canonical value (USD) on selection', () => {
            const onChange = vi.fn();
            render(
                <CanonicalScalarEditor
                    dataType="SELECT"
                    options={sampleOptions}
                    value=""
                    onChange={onChange}
                />
            );

            const trigger = screen.getByRole('combobox');
            fireEvent.click(trigger);

            const searchInput = screen.getByPlaceholderText(/search/i);
            expect(searchInput).toBeTruthy();

            // Type partial label "Dollar"
            fireEvent.change(searchInput, { target: { value: 'Dollar' } });

            // US Dollar should be displayed
            const optionItem = screen.getByText('US Dollar');
            expect(optionItem).toBeTruthy();
            expect(screen.queryByText('Euro')).toBeNull();

            // Select the item
            fireEvent.click(optionItem);

            // MUST emit the exact canonical value "USD", not "US Dollar" or "USD US Dollar"
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith('USD');
        });

        it('isolates Enter and Escape keyboard events to prevent accidental form submit or drawer close', () => {
            const onChange = vi.fn();
            const onSubmit = vi.fn((e) => e.preventDefault());
            const onDrawerKeyDown = vi.fn();

            render(
                <div onKeyDown={onDrawerKeyDown}>
                    <form onSubmit={onSubmit}>
                        <CanonicalScalarEditor
                            dataType="SELECT"
                            options={sampleOptions}
                            value=""
                            onChange={onChange}
                        />
                    </form>
                </div>
            );

            const trigger = screen.getByRole('combobox');
            fireEvent.click(trigger);

            const searchInput = screen.getByPlaceholderText(/search/i);
            expect(searchInput).toBeTruthy();

            // Pressing Enter in search input should not submit the parent form
            fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });
            expect(onSubmit).not.toHaveBeenCalled();

            // Pressing Escape inside the combobox popover should close popover without propagating to outer drawer
            fireEvent.keyDown(searchInput, { key: 'Escape', code: 'Escape' });
            expect(onDrawerKeyDown).not.toHaveBeenCalled();
            expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
        });

        it('supports ArrowDown, ArrowUp, and Enter keyboard navigation to select options', () => {
            const onChange = vi.fn();
            const fourOptions = [
                { value: 'USD', label: 'US Dollar' },
                { value: 'CAD', label: 'Canadian Dollar' },
                { value: 'AUD', label: 'Australian Dollar' },
                { value: 'EUR', label: 'Euro' }
            ];

            render(
                <CanonicalScalarEditor
                    dataType="SELECT"
                    options={fourOptions}
                    value=""
                    onChange={onChange}
                />
            );

            const trigger = screen.getByRole('combobox');
            fireEvent.click(trigger);

            const searchInput = screen.getByPlaceholderText(/search/i);
            searchInput.focus();

            // Type query leaving multiple visible results ("Dollar" matches USD, CAD, AUD)
            fireEvent.change(searchInput, { target: { value: 'Dollar' } });

            // Initial active/selected item after filtering should be USD
            const usdItem = screen.getByText('US Dollar').closest('[role="option"]');
            const cadItem = screen.getByText('Canadian Dollar').closest('[role="option"]');
            const audItem = screen.getByText('Australian Dollar').closest('[role="option"]');

            expect(usdItem?.getAttribute('aria-selected')).toBe('true');

            // Press ArrowDown to navigate to CAD
            fireEvent.keyDown(searchInput, { key: 'ArrowDown', code: 'ArrowDown' });
            expect(cadItem?.getAttribute('aria-selected')).toBe('true');

            // Press ArrowDown again to navigate to AUD
            fireEvent.keyDown(searchInput, { key: 'ArrowDown', code: 'ArrowDown' });
            expect(audItem?.getAttribute('aria-selected')).toBe('true');

            // Press ArrowUp to navigate back to CAD
            fireEvent.keyDown(searchInput, { key: 'ArrowUp', code: 'ArrowUp' });
            expect(cadItem?.getAttribute('aria-selected')).toBe('true');

            // Press Enter to select CAD
            fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith('CAD');
        });
    });
});
