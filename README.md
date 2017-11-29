# Reveal.js-d3

[Reveal.js](https://github.com/hakimel/reveal.js/) plugin to integrate [D3](https://d3js.org) visualizations into HTML slides and trigger transitions/animations fully compatible with the Reveal.js `data-fragment-index` fragements attribute. [Check out the live demo](https://gcalmettes.github.io/reveal.js-d3/demo/) and [code of the demo](https://github.com/gcalmettes/reveal.js-d3/tree/master/demo).

## Browser compatibility:

The plugin works best when slides are presented via Chrome and Safari. If the use of Firefox cannot be avoided, discard any responsive sizing features in the D3 code to prevent alteration in the rendering of the visualization.

## Principal features:

The development of this plugin has been inspired by [Reveal.js plugin - d3js](https://github.com/jlegewie/reveal.js-d3js-plugin), but has some major differences:
- the plugin itself is not dependent on `D3` and does not require to add `D3` in the dependencies of Reveal.js
- the D3 visualizations are loaded only when the slide hosting them becomes active.
- the D3 visualizations are removed when the slide is not active anymore (next slide) so the browser is not overloaded by running multiples iframes (this behavior [can be configured](#configuration)).
- this plugin support multiple visualizations on the same slide (and even multiple visualizations on the same slide + visualization on the background, if you're into those kind of things).
- the triggering of the transitions for the visualizations is fully compatible with Reveal.js [`data-fragment-index`](https://github.com/hakimel/reveal.js/#fragments) feature.

## Installation

### npm

(coming soon)

### Manual

1. Copy the file `reveald3.js` into a local folder, i.e. the `plugin/` folder of your Reveal.js presentation.

2. Add the `reveald3` plugin to the presentation dependencies:

```javascript
Reveal.initialize({
    // ...
    dependencies: [
        // ...
        { src: 'plugin/reveald3.js' },
        // ...
    ]
});
```



## Usage:

### Adding d3.js visualizations to slides

To add a d3.js visualizations to your presentation, simply add a container DOM element (`<div>`, `<span>`, etc ...) with the class `fig-container`, and give it a `data-file` attribute with the path of the html file hosting your d3.js visualization that you want to embed.

```html
<section>
    <div class="fig-container"
         data-file="d3-fig/eclipses.html"></div> // path to the html file with D3 code
</section>
```

To embed more than one visualization, simply create multiple containers:

```html
<section>
    <h3>Two visualizations side by side</h3>
    <div class="row">
        <div class="fig-container col-50" data-file="d3-fig/gooey.html"></div>
        <div class="fig-container col-50" data-file="d3-fig/modular-multiplication.html"></div>
        </div>
</section>
```

You can also embed the visualization in the background of the slide by adding the `fig-container` class directly to the `section` element of your Reveal.js code.

```html
<section class="fig-container"
        data-file="d3-fig/collision-detection.html">
    <h2>Some title</h2>

    <p>some text</p>
</section>
```

### Adding and controlling animations/transitions for the visualization(s)

To add transitions to a visualization, simply create a global (`var`) variable in the `D3` code of your `html` file with the name `_transitions`, and assign to it an array of javascript objects defining the transitions functions for each fragment steps. Each javascript object has one obligatory `name:value` pair as well as two optional `name:value` pairs:
- `transitionForward` (obligatory): defines a function for the transition from the current state TO the next state of the visualization
- `transitionBackward` (optional): defines a specific function to be ran for the transition FROM the next state to the current state when user navigates back. If no `transitionBackward` is specified, this will take the `transitionForward` value by default so the original state will be reverted. `transitionBackward` can also take a `"none"` value to specify that no animation/transition have to be ran for the reverse transition.
- `index` (optional): defines the `data-fragment-index` state at which the transition has to be triggered. If no `index` is defined, the transitions will be played in the order they appear in the `_transitions` array, with the first one getting the `0` index (first fragment played).

```
var _transitions = [
    {   transitionForward: () => (function to be run to the next state),
        transitionBackward: () => (function to be run from the next state), // optional
        index: 0 // optional
      }
    ]
```

Example:

```
var _transitions = [
      {
        transitionForward: () => recolorize("yellow"),
        index: 0 // will be run at the data-fragment-index=0 state
      },
      {
        transitionForward: () => recolorize("red"),
        transitionBackward: () => recolorize("blue"), // different behavior on the way back
        index: 3 // will be run at the data-fragment-index=3 state
      },
      {
        transitionForward: () => resize(0.1, 6),
      }, // no index, so will be played at the next data-fragment-index state (4)
    ]
```

For each slide containing at least one visualization, the plugin looks at the number and index of each transition in all the arrays `_transitions` for the different visualization embedded in the slide and automatically creates corresponding fragments (`<span>`) in the container slide if needed.

Note that each index specified is considered in context of the Reveal.js fragments already present in the slide. For example, if a slide has already 3 fragements (so the `data-fragment-index` states for the slides are 0, 1, 2) and a transition is set to `index: 14` in the `_transitions` array, the plugin will understand that this transition has to be played at the `data-fragment-index=3` (and not that 11 blank fragments have to be created before playing the transition).

## Configuration

You can configure some options for the behavior of the plugin in your presentation by providing a ```reveald3``` option in the Reveal.js initialization options. Note that all configuration values are optional and will default as specified below.

```javascript
Reveal.initialize({
    // ...

    reveald3: {
        // Specify if the last state of the visualization has to be 
        // triggered when navigating to a slide from a slide further
        // in the deck (i.e. we come back to the slide from the next slide).
        // By default the last fragment transition will be triggered to to
        // show the last state of the visualization. This behavior can be
        // discarded.
        dropLastState: false, // true/false, default: false

        // Specifies if iframes have to be kept on the slide once the
        // slide is not active anymore (presentation has switched to
        // next slide). If true, the final state of the visualization will
        // be the kept so that it will be the one displayed if we go back
        // to the slide. This is false by default, as it can be the source
        // of performance issues if complex visualizations (e.g. force layout)
        // are displayed and kept in the background
        keepIframe: false // true,false, default: false
     },

});
```
