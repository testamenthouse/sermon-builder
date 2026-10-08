// The `html` tag: htm bound to React.createElement, so components are plain template literals the browser runs
// as-is (no JSX, no build; React and htm are the globals set by vendor/). `<>…</>` fragments map to React.Fragment; components are interpolated: <${Foo}>…<//>.
(function (SB) {
'use strict';
const { createElement, Fragment } = React;
const html = htm.bind((type, props, ...children) => createElement(type === '' ? Fragment : type, props, ...children));
(SB.lib ||= {}).html = { html };
})(globalThis.SB ||= {});
