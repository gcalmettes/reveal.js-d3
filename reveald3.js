/**
 * reveal.js plugin to integrate d3.js visualizations into slides and trigger transitions supporting data-fragment-index
 */
var Reveald3 = window.Reveald3 || (function(){
    // check if configurations need to be overwritten
    const config = Reveal.getConfig();
    const options = config.reveald3 || {}; 

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
        let allContainers = getAllContainers(event.currentSlide)
        if(!allContainers.length) return;
        //fragments steps already in slide
        let slideFragmentSteps = getUniqueFragmentIndices(event)
        initializeAllVisualizations(allContainers, slideFragmentSteps)

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
        for (let i = 0; i<containerList.length; i++ ) {
            const file = containerList[i].getAttribute('data-file')
            initialize(containerList[i], file, slideFragmentSteps);
        }
    }

    function getUniqueFragmentIndices(event){
        let slide = event.currentSlide
        let slideFragments = slide.querySelectorAll( '.fragment' )
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
                    const startIndex = d3.max(visualizationIndices)+1 || 0
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
        const extraSteps = d3.sum(uniqueAllVisualizationIndices.map(d => d>nSlideFragmentSteps-1))
        let fragmentIndexToCreate
        if (extraSteps==0){
            fragmentIndexToCreate = []
        } else {
            fragmentIndexToCreate = d3.range(nSlideFragmentSteps, nSlideFragmentSteps+extraSteps)
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
                        transitionBackward: (visualizationSteps[j].transitionBackward == "none") ? () => {} : (visualizationSteps[j].transitionBackward) ? visualizationSteps[j].transitionBackward : visualizationSteps[j].transitionForward
                    }
                }

                allVisualizationStepsIndices.push(visualizationStepsIndices)
            }
        }

        return [allVisualizationStepsIndices, uniqueAllVisualizationIndices.map(d => hashTable[d])]
    }

    function initialize(element, file, slideFragmentSteps) {
        //current current slide and container to host the visualization
        const [slide, container] = getSlideAndContainer(element)

        //continue only if iframe hasn't been created already for this container
        const iframeList = container.querySelectorAll('iframe')
        if (iframeList.length>0) return;

        // embed html files as iframe
        // allowfullscreen mozallowfullscreen webkitallowfullscreen style="width: 100%; height: 100%; max-height: 100%; max-width: 100%;"
        const iframeContainer = d3.select(container)

        const iframe = iframeContainer.append('iframe')
                .attr('class', 'iframe-visualization')
                // .attr('id', id)
                .attr('sandbox', 'allow-popups allow-scripts allow-forms allow-same-origin')
                .attr('src', file)
                .attr('scrolling', 'no')
                .style('margin', '0 0 0 0')
                .style('width', '100%')
                .style('height', '100%')
                .style('max-width', '100%')
                .style('max-height', '100%')
                .style('z-index', 1)
            .node();

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
            let nodeList = d3.selectAll('iframe')._groups[0] // all the iframes hosting viz
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
            // need update-enter-merge-exit pattern since this is triggered
            // every time one of all the visualizations on the slides has finished loaded
            let fragmentSpans = d3.select(slide).selectAll('.fragment.visualizationStep')
                .data(spansToCreate);

            fragmentSpans.attr('class', 'fragment visualizationStep')

            let fragmentSpansEnter = fragmentSpans
                .enter()
                .append('span')
                    .attr('class', 'fragment visualizationStep')
                    .attr('data-fragment-index', d => d);

            let fragmentSpansMerge = fragmentSpansEnter
                .merge(fragmentSpans)
                    .attr('data-fragment-index', d => d);

            let fragmentSpansExit = fragmentSpans.exit().remove();

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

    function handleFragments(event, direction){
        //get data-fragment-index of current step
        let currentStep = event.fragments[0].getAttribute('data-fragment-index')

        // forward transition
        const slide = event.fragment.closest('section')
        const idx = Reveal.getIndices(slide)

        // get all iframe in foreground and background of slide
        // and convert NodeList to array
        const iframeSlide = Array.prototype.slice.call(slide.querySelectorAll('iframe'))
        const iframeBackground = Array.prototype.slice.call(Reveal.getSlideBackground(idx.h, idx.v).querySelectorAll('iframe'))

        // filter out non "iframe-visualization" iframes
        let allIframes = [].concat(...[iframeSlide, iframeBackground])
        allIframes = allIframes.filter(d => d.className.includes("iframe-visualization"))

        if (direction=="forward") {
            //loop over all the containers and trigger transition
            for (let i=0; i<allIframes.length; i++){
                if ((allIframes[i].transitionSteps) && (allIframes[i].transitionSteps[currentStep])) {
                   (allIframes[i].transitionSteps[currentStep].transitionForward || Function)()
                }
            }
        } else {
            //loop over all the containers and trigger transition
            for (let i=0; i<allIframes.length; i++){
                if ((allIframes[i].transitionSteps) && (allIframes[i].transitionSteps[currentStep])) {
                   (allIframes[i].transitionSteps[currentStep].transitionBackward || Function)()
                }
            }
        }
    }

})(); // Reveald3
