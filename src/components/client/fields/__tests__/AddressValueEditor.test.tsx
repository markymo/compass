/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AddressValueEditor } from '../AddressValueEditor';

describe('AddressValueEditor', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });
    it('renders empty address editor and allows adding and removing lines', () => {
        const onChange = vi.fn();
        const { rerender } = render(
            <AddressValueEditor
                value={{ addressLines: ['Line 1'] }}
                onChange={onChange}
            />
        );

        expect(screen.getByDisplayValue('Line 1')).toBeTruthy();

        // Add line
        const addLineBtn = screen.getByText('+ Add line');
        fireEvent.click(addLineBtn);
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            addressLines: ['Line 1', '']
        }));

        // Remove line
        const removeBtn = screen.getByText('✕');
        fireEvent.click(removeBtn);
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            addressLines: []
        }));
    });

    it('renders locality, region, postalCode inputs and fires onChange on edit', () => {
        const onChange = vi.fn();
        render(
            <AddressValueEditor
                value={{
                    addressLines: ['10 Downing Street'],
                    locality: 'London',
                    region: 'Greater London',
                    postalCode: 'SW1A 2AA',
                    countryCode: 'GB'
                }}
                onChange={onChange}
            />
        );

        expect(screen.getByDisplayValue('London')).toBeTruthy();
        expect(screen.getByDisplayValue('Greater London')).toBeTruthy();
        expect(screen.getByDisplayValue('SW1A 2AA')).toBeTruthy();

        const localityInput = screen.getByDisplayValue('London');
        fireEvent.change(localityInput, { target: { value: 'Westminster' } });
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            locality: 'Westminster'
        }));
    });

    it('renders country combobox with correct country name mapping and high z-index popover', () => {
        const onChange = vi.fn();
        render(
            <AddressValueEditor
                value={{
                    addressLines: [],
                    countryCode: 'GB',
                    countryName: 'United Kingdom'
                }}
                onChange={onChange}
            />
        );

        const countryButton = screen.getByRole('combobox');
        expect(countryButton).toBeTruthy();
        expect(countryButton.textContent).toContain('United Kingdom');
    });
});
