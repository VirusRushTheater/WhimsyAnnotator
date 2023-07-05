import * as React from "react";
import {useRef, useState, useEffect, createContext, useContext, useReducer} from "react";

const ImageContext = createContext(null);
const TransformContext = createContext(null);

/**
 * Used to convert Python Bytes to Base64.
 * Not the most efficient method around but it just werks.
 */
function dataViewToB64(dview)
{
    const retval = btoa(Array.from({length: dview.byteLength}, (_, i) => String.fromCharCode(dview.getUint8(i))).join(''));
    return retval;
}

/**
 * Method to locate mouse events within a DOM element.
 */
function mouseRelativeCoordinates(this_element, mouse_event)
{
    const {clientX, clientY, target} = mouse_event;
    const clientRect = this_element.getBoundingClientRect();
    const [dx, dy] = [clientX - clientRect.x, clientY - clientRect.y];
    const [dx_rel_viewport, dy_rel_viewport] = [dx / clientRect.width, dy / clientRect.height];

    return {dx, dy, dx_rel_viewport, dy_rel_viewport};
}

/**
 * Some way to hardcode FontAwesome icons and deliver them as React assets.
 */
function Icon({name})
{
    const ICONS = {
        arrow_left: {'xmlns': 'http://www.w3.org/2000/svg', 'height': '1em', 'viewBox': '0 0 448 512', 'd': 'M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.2 288 416 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-306.7 0L214.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z'},
        arrow_right: {'xmlns': 'http://www.w3.org/2000/svg', 'height': '0.4em', 'viewBox': '0 0 448 512', 'd': 'M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z'},
        magnifying_glass_plus: {'xmlns': 'http://www.w3.org/2000/svg', 'height': '1em', 'viewBox': '0 0 512 512', 'd': 'M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM184 296c0 13.3 10.7 24 24 24s24-10.7 24-24V232h64c13.3 0 24-10.7 24-24s-10.7-24-24-24H232V120c0-13.3-10.7-24-24-24s-24 10.7-24 24v64H120c-13.3 0-24 10.7-24 24s10.7 24 24 24h64v64z'},
        magnifying_glass_minus: {'xmlns': 'http://www.w3.org/2000/svg', 'height': '1em', 'viewBox': '0 0 512 512', 'd': 'M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM136 184c-13.3 0-24 10.7-24 24s10.7 24 24 24H280c13.3 0 24-10.7 24-24s-10.7-24-24-24H136z'}
    };

    const sel_icon = ICONS[name];
    return <svg xmlns={sel_icon.xmlns} height={sel_icon.height} viewBox={sel_icon.viewBox}><path d={sel_icon.d}/></svg>;
}

/**
 * Displays information, a panel to scroll between images and different labels to be used mainly on mobile devices.
 */
function Toolbox()
{
    return <div className="toolbox">
        <div className="toolbox-container2">
            <div className="toolbox-row toolbox-imgcounter">
                <h4>My dataset</h4>
                <h2>30 / 30</h2>
            </div>
            <div className="toolbox-row">
                <button className="toolbox-btn4"><Icon name="arrow_left" /></button>
                <button className="toolbox-btn4"><Icon name="arrow_right" /></button>
            </div>
        </div>
    </div>
}

/**
 * Handles the viewport events and contains the image as a canvas and the annotations as a svg.
 */
function Viewport({children, onMouseZoom, onPan})
{
    const CHECKBOARD_PATTERN_SVG = "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCI+IDxyZWN0IHdpZHRoPSIyNSIgaGVpZ2h0PSIyNSIgZmlsbD0iIzExMSIgLz4gPHJlY3QgeD0iMjUiIHdpZHRoPSIyNSIgaGVpZ2h0PSIyNSIgZmlsbD0iIzMzMyIgLz4gPHJlY3QgeT0iMjUiIHdpZHRoPSIyNSIgaGVpZ2h0PSIyNSIgZmlsbD0iIzMzMyIgLz4gPHJlY3QgeD0iMjUiIHk9IjI1IiB3aWR0aD0iMjUiIGhlaWdodD0iMjUiIGZpbGw9IiMxMTEiIC8+IDwvc3ZnPg==";
    const {img_b64, img_w, img_h} = useContext(ImageContext);
    const {viewportState: {zoom, position:[dx, dy]}, viewportDispatch} = useContext(TransformContext);

    const [isPanning, setPanning] = useState(false);
    const containerRef = useRef();

    // Native mouse wheel event is set here so it doesn't propagate upwards.
    useEffect(() => {
        const containerDOM = containerRef.current;
        let pan_dx0, pan_dy0, pan_dxv, pan_dyv;

        function wheelEvent(mouse_event)
        {
            mouse_event.preventDefault();
            const {dx, dx_rel_viewport, dy, dy_rel_viewport} = mouseRelativeCoordinates(containerDOM, mouse_event);
            const direction = (mouse_event.deltaY < 0) ? "up" : "down";

            // Call the onWheel callback or dumps the call if no callback.
            (onMouseZoom || (() => {}))({
                dx, dx_rel_viewport, dy, dy_rel_viewport, direction
            });
        }

        function mouseDownEvent(mouse_event)
        {
            const {dx, dx_rel_viewport, dy, dy_rel_viewport} = mouseRelativeCoordinates(containerRef.current, mouse_event);
            pan_dx0 = mouse_event.screenX; pan_dy0 = mouse_event.screenY; pan_dxv = dx; pan_dyv = dy;

            console.log("mouseDownEvent", pan_dxv, pan_dyv);

            window.addEventListener("mousemove", mouseMoveEvent);
            window.addEventListener("mouseup", mouseUpEvent);
        }

        function mouseMoveEvent(mouse_event)
        {
            setViewportDx(pan_dxv + (mouse_event.screenX - pan_dx0));
            setViewportDy(pan_dyv + (mouse_event.screenY - pan_dy0));
        }

        function mouseUpEvent(mouse_event)
        {
            window.removeEventListener("mousemove", mouseMoveEvent);
            window.removeEventListener("mouseup", mouseUpEvent);
            
            window.blur();
            setViewportDx(pan_dxv + (mouse_event.screenX - pan_dx0));
            setViewportDy(pan_dyv + (mouse_event.screenY - pan_dy0));
        }

        containerDOM.addEventListener("wheel", wheelEvent, {passive: false});
        containerDOM.addEventListener("mousedown", mouseDownEvent);

        return () => {
            containerDOM.removeEventListener("wheel", wheelEvent, {passive: false});
            containerDOM.removeEventListener("mousedown", mouseDownEvent);
        }
    }, []);

    return <div className="ann-container1" style={{overflow: "hidden"}} ref={containerRef}>
        <div className="ann-container2a" style={{
            backgroundImage: "url(data:image/svg+xml;base64," + CHECKBOARD_PATTERN_SVG + ")"
        }}>
        </div>
        ({children.map((child_i) => <div className="ann-container2r">
            {child_i}
        </div>)})
    </div>
}

/**
 * Displays the image supplied dynamically from the Python backend.
 */
function ImageCanvas()
{
    const canvasRef = useRef();
    const {img_b64, img_w, img_h} = useContext(ImageContext);
    const {viewportState: {zoom, position:[dx, dy]}, viewportDispatch} = useContext(TransformContext);

    useEffect(() => {
        const canvas = canvasRef.current;
        var ctx = canvas.getContext("2d");

        var image_elem = new Image();
        image_elem.onload = () => {
            ctx.drawImage(image_elem, 0, 0);
        }
        image_elem.src = img_b64;

    }, [img_w, img_h, img_b64])

    return <canvas ref={canvasRef} width={img_w} height={img_h} style={{
        transform: `scale(${zoom}) translate(${dx}px, ${dy}px)`
    }}/>
}

/**
 * Annotations in a nice SVG format.
 */
function AnnotationHost({children})
{
    const {img_w, img_h} = useContext(ImageContext);
    const {viewportState: {zoom, position:[dx, dy]}, viewportDispatch} = useContext(TransformContext);

    return <svg xmlns="http://www.w3.org/2000/svg"
        width={2*img_w*zoom}
        height={2*img_h*zoom}
        viewBox="-0.5 -0.5 2 2"
    >
        {children}
    </svg>
}

function Annotation({x, y, w, h, label, type, confidence, uuid})
{
    return <rect x={x} y={y} width={w} height={h} fill="none" stroke="blue" strokeWidth="3" vector-effect="non-scaling-stroke"/>
}

/**
 * 
 * @param {*} props 
 * @returns 
 */
export default function Widget(props) {
    const {
        // All of these are names tied with the Python backend.
        // Make sure you change them there before you change them here.
        img_data, img_mimetype, img_path,
        img_w, img_h,
        annotations, set_annotations,
        labels, set_labels,
    debug} = props;

    // They told me this could be better than using states, right?
    function viewportReducer(prev_state, {type, parameter})
    {
        switch (type)
        {
            case "zoom":
                return {...prev_state, zoom: parameter};
            case "zoom_wheel":
                return {...prev_state, zoom: prev_state.zoom * (parameter === "up" ? 1.25 : 0.8)};
            case "position":
                return {...prev_state, position: parameter};
        }
    }

    const [viewportState, viewportDispatch] = useReducer(viewportReducer, 
        {zoom: 1.0, position: [0.0, 0.0]}
    );

    function mouseZoomEvent({dx, dx_rel, dy, dy_rel, direction})
    {
        viewportDispatch({type: "zoom_wheel", parameter: direction});
    }

    return <div className="ann-container0">
        <ImageContext.Provider
            value={{
                img_w, img_h, img_path,
                img_b64: `data:${img_mimetype};base64,${dataViewToB64(img_data)}`
            }}
        >
            <TransformContext.Provider value={{viewportState, viewportDispatch}}>
                <Toolbox />
                <Viewport onMouseZoom={mouseZoomEvent}>
                    <ImageCanvas />
                    <AnnotationHost>
                        {annotations.map((annotation_i) => <Annotation {...annotation_i} />)}
                    </AnnotationHost>
                </Viewport>

            </TransformContext.Provider>
        </ImageContext.Provider>
    </div>
};
