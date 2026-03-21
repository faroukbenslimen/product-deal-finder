import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FilterBar from './FilterBar';

type ChildrenElement = React.ReactElement<{ children?: React.ReactNode }>;
type ChangeElement = React.ReactElement<{ onChange: (event: { target: { value: string } }) => void }>;

describe('FilterBar', () => {
  it('renders detected currency in max price label and placeholder', () => {
    const html = renderToStaticMarkup(
      React.createElement(FilterBar, {
        maxPrice: '',
        selectedStore: 'All',
        minRating: 0,
        uniqueStores: ['Store A'],
        detectedCurrency: 'TND',
        onMaxPriceChange: () => undefined,
        onStoreChange: () => undefined,
        onMinRatingChange: () => undefined,
      })
    );

    expect(html).toContain('Max price (TND):');
    expect(html).toContain('placeholder="Max price (TND)"');
  });

  it('invokes change handlers with expected typed values', () => {
    const onMaxPriceChange = vi.fn();
    const onStoreChange = vi.fn();
    const onMinRatingChange = vi.fn();

    const element = FilterBar({
      maxPrice: '',
      selectedStore: 'All',
      minRating: 0,
      uniqueStores: ['Store A'],
      detectedCurrency: 'USD',
      onMaxPriceChange,
      onStoreChange,
      onMinRatingChange,
    });

    const rootChildren = React.Children.toArray(element.props.children);
    const controlsWrapper = rootChildren[0] as ChildrenElement;
    const controlBlocks = React.Children.toArray(controlsWrapper.props.children);

    const priceBlock = controlBlocks[0] as ChildrenElement;
    const priceChildren = React.Children.toArray(priceBlock.props.children);
    const priceInput = priceChildren[1] as ChangeElement;
    priceInput.props.onChange({ target: { value: '123' } });
    priceInput.props.onChange({ target: { value: '' } });

    const storeBlock = controlBlocks[1] as ChildrenElement;
    const storeChildren = React.Children.toArray(storeBlock.props.children);
    const storeSelect = storeChildren[1] as ChangeElement;
    storeSelect.props.onChange({ target: { value: 'Store A' } });

    const ratingBlock = controlBlocks[2] as ChildrenElement;
    const ratingChildren = React.Children.toArray(ratingBlock.props.children);
    const ratingSelect = ratingChildren[1] as ChangeElement;
    ratingSelect.props.onChange({ target: { value: '4.5' } });

    expect(onMaxPriceChange).toHaveBeenNthCalledWith(1, 123);
    expect(onMaxPriceChange).toHaveBeenNthCalledWith(2, '');
    expect(onStoreChange).toHaveBeenCalledWith('Store A');
    expect(onMinRatingChange).toHaveBeenCalledWith(4.5);
  });
});
