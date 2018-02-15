/**
 * reveal.js plugin to integrate d3.js visualizations into slides and trigger transitions supporting data-fragment-index
 */
var Reveald3 = window.Reveald3 || (function(){
    // check if configurations need to be overwritten
    const config = Reveal.getConfig() || {};
    config.reveald3 = config.reveald3 || {};

    const options = {
          // If the previous slide is a slide further in the deck (i.e. we come back to
          // slide from the next slide), by default the last fragment transition will be
          // triggered to to get the last state of the visualization. This can be
          // discarded.
          runLastState: !config.reveald3.runLastState, //default true

          // If true, do not drop the iframe once the slide is not active anymore
          // Default is false since keeping the iframes running can overwhelm the browser
          // depending of the complexity of the visualization. The need for this option
          // to be true is when the last fragment transition is not a state per se but
          // the result of the multiple previous transitions, and the "triggerLastTransition"
          // option is not sufficient to recover the last state.
          keepIframe: !!config.reveald3.keepIframe, // default: false

          // This will prefix the path attributes of the source html paths with the given path.
          // (by default "src" if set to true or with the specified path if string)
          mapPath: typeof(config.reveald3.mapPath) == 'string' ? config.reveald3.mapPath : ( config.reveald3.mapPath ? 'src' : '' ),

          // If true, will try to locate the file at a fallback url without the mapPath prefix in case no file is found
          // at the stipulated url with mapPath
          tryFallbackURL: !!config.reveald3.tryFallbackURL, //default false
        };

    // propagate keydown when focus is on iframe (child)
    // https://stackoverflow.com/a/41361761/2503795
    window.document.addEventListener('iframe-keydown',
        (event) => Reveal.triggerKey(event.detail.keyCode), false);


    /////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////
    //
    //              Functions for SLIDE EVENTS
    //
    /////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////

    // Both "ready" and "slidechanged" Revealjs eventListeners are added to load
    // the D3 visualizations on the slides. The "ready" event is there only for the
    // specific case where there is a D3 visualization on first slide
    Reveal.addEventListener('ready', function( event ) {
        handleSlideVisualizations(event)
    });

    Reveal.addEventListener('slidechanged', function( event ) {
        handleSlideVisualizations(event)
    });

    if (options.keepIframe){
        // if iframes are kept, no need for rendering of last state when
        // navigating back from slide.
        options['runLastState'] = false;
    }

    if (!options.keepIframe){

        Reveal.addEventListener('slidechanged', function( event ) {
            // For performance, dump iframe visualization containers once the
            // slide has changed so the browser is not overloaded with running iframes
            let previousSlide = event.previousSlide
            let allIframes = []
            if (previousSlide){
                const idx = Reveal.getIndices(previousSlide)
                const iframeSlide = Array.prototype.slice.call(previousSlide.querySelectorAll('iframe'))
                const iframeBackground = Array.prototype.slice.call(Reveal.getSlideBackground(idx.h, idx.v).querySelectorAll('iframe'))

                // filter out non "iframe-visualization" iframes
                allIframes = [].concat(...[iframeSlide, iframeBackground])
                allIframes = allIframes.filter(d => d.className.includes("iframe-visualization"))

                for (let i=0; i<allIframes.length; i++){
                    allIframes[i].remove()
                }
            }

        });
    }


    function handleSlideVisualizations(event){
        const currentSlide = event.currentSlide
        let allContainers = getAllContainers(currentSlide)
        if(!allContainers.length) return;
        //fragments steps already in slide
        let slideFragmentSteps = getUniqueFragmentIndices(event)

        initializeAllVisualizations(allContainers, slideFragmentSteps)

        if (options.runLastState){
            // is it a navigation back from other slide event?
            triggerLastState(event)
        }
    }

    function triggerLastState(event){
        // If the previous slide is a slide further in the deck (i.e. we come back to
        // slide from the next slide), trigger the last fragment transition to get the
        // the last state
        const currentSlide = event.currentSlide
        const idxCurrent = Reveal.getIndices(currentSlide)
        const idxPrevious = Reveal.getIndices(event.previousSlide)
        if ((idxCurrent.h<idxPrevious.h) || idxCurrent.v<idxPrevious.v){
            const allFragments = currentSlide.querySelectorAll('.fragment.visualizationStep')
            if (allFragments.length==0) return
            let allFragmentsIndices = []
            for (let i=0; i< allFragments.length; i++){
                allFragmentsIndices.push(parseInt(allFragments[i].getAttribute('data-fragment-index')))
            }
            const allIframes = getAllIframes(currentSlide)
            for (let i=0; i<allIframes.length; i++){
                const iframe = allIframes[i]
                iframe.addEventListener("load", function () {
                    triggerAllTransitions(allIframes, Math.max.apply(null, allFragmentsIndices), 'forward')
                })
            }
        }
    }

    function getAllContainers(slide){
        let allContainers = slide.className.includes("fig-container") ? [slide] : []
        const innerContainers = slide.querySelectorAll('.fig-container')
        if (innerContainers.length>0) {
            for (let i=0; i<innerContainers.length; i++){
                allContainers.push(innerContainers[i])
            }
        }
        return allContainers
    }

    function getSlideAndContainer(element){
        const background = element.tagName == 'SECTION'
        const slide = background ? element : element.closest('section')
        const idx = Reveal.getIndices(slide)
        const slide_background = background ? Reveal.getSlideBackground(idx.h, idx.v) : undefined;
        const container = background ? slide_background : element;

        return [slide, container]
    }

    function initializeAllVisualizations(containerList, slideFragmentSteps){
        // Default style
        const defaultStyle = {
          'margin': '0px',
          'width': '100vw',
          'height': '100vh',
          'max-width': '100%',
          'max-height': '100%',
          'z-index': 1
        }

        for (let i = 0; i<containerList.length; i++ ) {
            const file = containerList[i].getAttribute('data-file')
            
            // get inputted iframe styles via the data-style attribute and parse it
            const dataStyleString = containerList[i].getAttribute('data-style') ? containerList[i].getAttribute('data-style') : "";
            // const regexStyle = /\s*([^;^\s]*)\s*:\s*([^;^\s]*)/g
            const regexStyle = /\s*([^;^\s]*)\s*:\s*([^;^\s]*(\s*)?(!important)?)/g

            let inputtedStyle = {}, matchStyleArray;
            while (matchStyleArray = regexStyle.exec(dataStyleString)) {
              inputtedStyle[matchStyleArray[1]] = matchStyleArray[2]
            }
            const iframeStyle = Object.assign(defaultStyle, inputtedStyle)

            initialize(containerList[i], file, slideFragmentSteps, iframeStyle);
        }
    }

    function getUniqueFragmentIndices(event){
        const slide = event.currentSlide
        let slideFragments = Array.prototype.slice.call(slide.querySelectorAll( '.fragment' ))
        // filter out fragments created for transition steps, if any
        slideFragments = slideFragments.filter(d => !d.className.includes("visualizationStep"))
        let fragmentIndices = []
        for (let i=0; i<slideFragments.length; i++){
            fragmentIndices.push(parseInt(slideFragments[i].getAttribute( 'data-fragment-index' )))
        }
        fragmentIndices = [...new Set(fragmentIndices)];
        return fragmentIndices
    }

    function generateVisualizationStepsIndices(allVisualizationSteps, slideFragmentSteps){
        // add data-fragment-index to missing steps for each viz
        let allVisualizationIndices = []
        for (let i=0; i<allVisualizationSteps.length; i++){
            const visualizationSteps = allVisualizationSteps[i]

            let visualizationIndices

            if(visualizationSteps){
                const nVisualizationSteps = visualizationSteps.length

                visualizationIndices = visualizationSteps.filter(d => d.index>=0).map(d => d.index)
                if (visualizationIndices.length < nVisualizationSteps) {
                    const nIndicesToAdd = nVisualizationSteps - visualizationIndices.length
                    const startIndex = visualizationIndices.length == 0 ? 0 : Math.max.apply(null, visualizationIndices)+1
                    for (let j=0; j<nIndicesToAdd; j++){
                        visualizationIndices.push(j+startIndex)
                    }
                }
                allVisualizationIndices.push(visualizationIndices)
            }
        }

        // some spread operator kungfu techniques to get unique values of data-fragment-index in viz
        let uniqueAllVisualizationIndices = [...new Set([].concat(...allVisualizationIndices))]
        uniqueAllVisualizationIndices.sort((a, b) => a - b)

        // Generate data-fragment-index list of spans to be added to slide
        const nSlideFragmentSteps = slideFragmentSteps.length

        const extraIndex = uniqueAllVisualizationIndices.map(d => d>nSlideFragmentSteps-1)
        const extraSteps = extraIndex.reduce((a, b) => a+b, 0);

        let fragmentIndexToCreate
        if (extraSteps==0){
            fragmentIndexToCreate = []
        } else {
            // range [nSlideFragmentSteps, nSlideFragmentSteps+extraSteps]
            fragmentIndexToCreate = [...Array(extraSteps).keys()].map(d => d+nSlideFragmentSteps)
        }

        // hash table for correspondance (data-fragment-index <=> slide fragments sequence)
        let hashTable = {}
        let count = 0
        uniqueAllVisualizationIndices.forEach(d => {
            if (d>nSlideFragmentSteps-1){
                hashTable[d] = fragmentIndexToCreate[count]
                count+=1
            } else {
                hashTable[d] = d
            }
        })

        // convert visualization indices to the right slide data-fragment-index
        let allVisualizationStepsIndices = []
        for (let i=0; i<allVisualizationSteps.length; i++){
            const visualizationSteps = allVisualizationSteps[i]
            const visualizationIndices = allVisualizationIndices[i]

            if ((visualizationSteps) && (visualizationIndices)){
                const nVisualizationSteps = visualizationSteps.length

                let visualizationStepsIndices = {}

                for (let j=0; j<nVisualizationSteps; j++) {
                    visualizationStepsIndices[hashTable[visualizationIndices[j]]] = {
                        transitionForward: visualizationSteps[j].transitionForward,
                        transitionBackward: (visualizationSteps[j].transitionBackward == "none") ? () => {} : (visualizationSteps[j].transitionBackward) ? visualizationSteps[j].transitionBackward : visualizationSteps[(j-1 >= 0 ? j-1 : 0)].transitionForward
                    }
                }

                allVisualizationStepsIndices.push(visualizationStepsIndices)
            }
        }

        return [allVisualizationStepsIndices, uniqueAllVisualizationIndices.map(d => hashTable[d])]
    }

    function getAllIframes(slide){
        const idx = Reveal.getIndices(slide)

        // get all iframe in foreground and background of slide
        // and convert NodeList to array
        const iframeSlide = Array.prototype.slice.call(slide.querySelectorAll('iframe'))
        const iframeBackground = Array.prototype.slice.call(Reveal.getSlideBackground(idx.h, idx.v).querySelectorAll('iframe'))

        // filter out non "iframe-visualization" iframes
        let allIframes = [].concat(...[iframeSlide, iframeBackground])
        allIframes = allIframes.filter(d => d.className.includes("iframe-visualization"))
        return allIframes
    }

    function doesFileExist( address ) {
        const client = new XMLHttpRequest();
        client.onload = function() {
          // in case of network errors this might not give reliable results
          returnStatus(this.status, address);
        }
        client.open( "HEAD", address, true);
        client.send();
    }
  
      function returnStatus(status, urlToFile) {
        if ( status === 200 ) {
          // console.log( 'file exists!' );
          return true
        }
        else {
          console.log(`Error ${status}. Couldn't locate "${urlToFile}", fallback to original url at "${urlToFile.slice(options.mapPath.length)}"`)
          return false
        }
      }

    function initialize(element, file, slideFragmentSteps, iframeStyle) {
        // current current slide and container to host the visualization
        const [slide, container] = getSlideAndContainer(element)

        // by default hid overflow of container so combining iframe margins and height/width
        // can be used to define an area without seeing the overflow.
        // This can be overridden using the data-overflow-shown=true attribute
        container.style.overflow = (container.style.overflow=="" && !JSON.parse(container.getAttribute('data-overflow-shown'))) ? 'hidden' : container.style.overflow

        // continue only if iframe hasn't been created already for this container
        const iframeList = container.querySelectorAll('iframe')
        if (iframeList.length>0) return;

        const filePath = (options.tryFallbackURL && doesFileExist(options.mapPath + file)) ? options.mapPath + file : file

        // generate styles string
        const styles = Object.entries(iframeStyle)
          .reduce((res, [key, value]) => `${res}${key}:${String(value).replace(/\s+/, " ")};`, "")

        // create iframe to embed html file
        let iframeConfig = {
            'class': 'iframe-visualization',
            'sandbox': 'allow-popups allow-scripts allow-forms allow-same-origin',
            'src': filePath,
            'style': styles
        }

        const iframe = document.createElement('iframe')
        for (let i=0; i<Object.keys(iframeConfig).length; i++){
            const key = Object.keys(iframeConfig)[i]
            iframe.setAttribute(key, iframeConfig[key])
        }
        // add iframe as child to div.fig-container
        container.appendChild(iframe)

        //event to be triggered once iframe load is complete
        iframe.addEventListener("load", function () {
            const fig = (iframe.contentWindow || iframe.contentDocument);

            // add custom event listener to propatage key presses to parent
            // https://stackoverflow.com/a/41361761/2503795
            fig.addEventListener('keydown', function(e) {
                const event = new CustomEvent('iframe-keydown', { detail: e });
                window.parent.document.dispatchEvent(event)
            });

            ///////////////////////////////////////////////////////////////////////////
            // If more than one visualization on the slide, intelligently create/update
            // the data-fragment indices for each steps of each visualization, taking
            // in account all the data-fragment-indices stipulated for each viz
            //////////////////////////////////////////////////////////////////////////

            // get all the visualization steps from all the visualizations on the slide
            let nodeList = getAllIframes(slide)
            let allVisualizationSteps = []
            for (let i=0; i<nodeList.length; i++){
                const iframe = nodeList[i];
                const fig = (iframe.contentWindow || iframe.contentDocument);
                allVisualizationSteps.push(fig._transitions)
            }

            // get the corresponding data-fragment-index in the slide fragment context
            // and see if new spans have to be created to trigger visualization steps
            const [allVizStepsDict, spansToCreate] = generateVisualizationStepsIndices(allVisualizationSteps, slideFragmentSteps)

            // store the visualization steps to be triggered in a variable attached to each iframe
            for (let i=0; i<nodeList.length; i++){
                const iframe = nodeList[i];
                iframe.transitionSteps = allVizStepsDict[i];
            }

            // add spans fragments to trigger visualization steps
            let fragmentSpans = slide.querySelectorAll('.fragment.visualizationStep')
            if (fragmentSpans.length < spansToCreate.length){
                const nSpansToCreate = spansToCreate.length - fragmentSpans.length
                for (let i=0; i<nSpansToCreate; i++){
                    const spanFragment = document.createElement('span')
                    spanFragment.setAttribute('class', 'fragment visualizationStep')
                    slide.appendChild(spanFragment)
                }
            }
            fragmentSpans = slide.querySelectorAll('.fragment.visualizationStep')
            for (let i=0; i<spansToCreate.length; i++){
                fragmentSpans[i].setAttribute('data-fragment-index', spansToCreate[i])
            }
        }); //onload

    }


    /////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////
    //
    //              Functions for FRAGMENTS EVENTS
    //
    /////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////

    // Fragmentshown and fragmenthidden Revealjs events to trigger
    // the transitions (and inverse transitions) in the D3 visualization
    Reveal.addEventListener('fragmentshown', function(event) {
        //proceed only if this is a visualizationStep fragment
        if (!proceed(event)) return;
        handleFragments(event, 'forward')
    });

    Reveal.addEventListener('fragmenthidden', function(event) {
        //proceed only if this is a visualizationStep fragment
        if (!proceed(event)) return;
        handleFragments(event, 'backward')
    });


    function proceed(event) {
        // only proceed if one of the fragments of the step has `fig-transition` class
        let allClassNames = ""
        for (let i=0; i<event.fragments.length; i++){
            allClassNames = allClassNames.concat(event.fragments[i].className)
        }
        return allClassNames.includes('visualizationStep')
    }

    function triggerAllTransitions(allIframes, currentStep, direction){
        for (let i=0; i<allIframes.length; i++){
            triggerTransition(allIframes[i], currentStep, direction)
        }
    }

    function triggerTransition(iframe, currentStep, direction){
        if (direction=="forward") {
            if ((iframe.transitionSteps) && (iframe.transitionSteps[currentStep])) {
               (iframe.transitionSteps[currentStep].transitionForward || Function)()
            }

        } else {
            if ((iframe.transitionSteps) && (iframe.transitionSteps[currentStep])) {
               (iframe.transitionSteps[currentStep].transitionBackward || Function)()
            }
        }
    }

    function handleFragments(event, direction){
        //get data-fragment-index of current step
        let currentStep = parseInt(event.fragments[0].getAttribute('data-fragment-index'))

        // forward transition
        const slide = event.fragment.closest('section')

        // get all iframe embedding visualisations
        let allIframes = getAllIframes(slide)

        triggerAllTransitions(allIframes, currentStep, direction)
    }

})(); // Reveald3
