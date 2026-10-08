// The `html` tag: htm bound to React.createElement, so components are plain template literals the browser runs
// as-is (no JSX, no build). `<>…</>` fragments map to React.Fragment; components are interpolated: <${Foo}>…<//>.
import { createElement, Fragment } from 'react';
import htm from 'htm';
export const html = htm.bind((type, props, ...children) => createElement(type === '' ? Fragment : type, props, ...children));
