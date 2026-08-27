import { fireEvent } from '@testing-library/react';

// jsdom has no TouchEvent constructor, so @testing-library/dom's fireEvent.touchStart
// falls back to a plain Event and silently drops touch-list properties (they aren't
// part of the base Event constructor's init dict). Build the event by hand instead,
// attaching `touches`/`changedTouches` directly so React's SyntheticEvent (which reads
// them straight off the native event) sees them.
const buildTouchEvent = (type: string, touches: { identifier: number }[], changedTouches: { identifier: number }[]) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: touches, configurable: true });
  Object.defineProperty(event, 'changedTouches', { value: changedTouches, configurable: true });
  return event;
};

/** Simulate a finger touching down on `element`, identified by `identifier`. */
export const touchStart = (element: Element, identifier: number, activeTouches: number[] = [identifier]) => {
  fireEvent(element, buildTouchEvent(
    'touchstart',
    activeTouches.map(id => ({ identifier: id })),
    [{ identifier }]
  ));
};

/** Simulate the touch identified by `identifier` lifting off `element`, with `remaining` still down. */
export const touchEnd = (element: Element, identifier: number, remaining: number[] = []) => {
  fireEvent(element, buildTouchEvent(
    'touchend',
    remaining.map(id => ({ identifier: id })),
    [{ identifier }]
  ));
};
