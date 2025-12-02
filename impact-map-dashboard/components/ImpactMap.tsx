import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GlassCard } from './GlassCard';
import { AccountData } from '../types';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface ImpactMapProps {
    data: AccountData[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export const ImpactMap: React.FC<ImpactMapProps> = ({ data, selectedId, onSelect }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState(d3.zoomIdentity);

    useEffect(() => {
        if (!svgRef.current || !containerRef.current || data.length === 0) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const padding = 60; // Increased padding for better label visibility

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // Scales
        // X: Net Flow Ratio (-1 to 1)
        const xScale = d3.scaleLinear()
            .domain([-1.2, 1.2]) 
            .range([padding, width - padding]);

        // Y: ROI 
        const yMax = d3.max(data, d => d.roi) || 100;
        const yMin = d3.min(data, d => d.roi) || -50;
        const yScale = d3.scaleLinear()
            .domain([yMin - 20, yMax + 20])
            .range([height - padding, padding]);

        // Size: AII (0-100) -> Radius (4-30)
        const sizeScale = d3.scaleSqrt()
            .domain([0, 100])
            .range([6, 32]);

        const g = svg.append("g");

        // Axes - Style for Dark Mode
        const xAxis = d3.axisBottom(xScale).ticks(5);
        const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}%`);

        // Grid lines
        g.append("g")
            .attr("class", "grid-lines")
            .attr("transform", `translate(0,${height - padding})`)
            .call(d3.axisBottom(xScale).ticks(5).tickSize(-(height - 2 * padding)).tickFormat(() => ""))
            .attr("color", "rgba(255,255,255,0.05)")
            .select(".domain").remove();
        
        g.append("g")
            .attr("class", "grid-lines")
            .attr("transform", `translate(${padding},0)`)
            .call(d3.axisLeft(yScale).ticks(5).tickSize(-(width - 2 * padding)).tickFormat(() => ""))
            .attr("color", "rgba(255,255,255,0.05)")
            .select(".domain").remove();

        // Center Axis Lines
        g.append("line")
            .attr("x1", xScale(0))
            .attr("y1", padding)
            .attr("x2", xScale(0))
            .attr("y2", height - padding)
            .attr("stroke", "rgba(255,255,255,0.2)")
            .attr("stroke-dasharray", "4")
            .attr("stroke-width", 1);

        g.append("line")
            .attr("x1", padding)
            .attr("y1", yScale(0))
            .attr("x2", width - padding)
            .attr("y2", yScale(0))
            .attr("stroke", "rgba(255,255,255,0.2)")
            .attr("stroke-dasharray", "4")
            .attr("stroke-width", 1);

        // Labels
        g.append("text")
            .attr("x", width / 2)
            .attr("y", height - 20)
            .attr("text-anchor", "middle")
            .attr("fill", "#94a3b8")
            .attr("font-size", "11px")
            .attr("font-weight", "600")
            .attr("letter-spacing", "1px")
            .text("NET FLOW RATIO (SELL ← → BUY)");
        
        g.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("fill", "#94a3b8")
            .attr("font-size", "11px")
            .attr("font-weight", "600")
            .attr("letter-spacing", "1px")
            .text("ROI (%)");

        // Zoom
        const zoom = d3.zoom()
            .scaleExtent([0.5, 5])
            .on("zoom", (event) => {
                setTransform(event.transform);
                g.attr("transform", event.transform);
            });

        svg.call(zoom as any);

        // Define gradients
        const defs = svg.append("defs");
        
        // Glow filter
        const filter = defs.append("filter")
            .attr("id", "glow")
            .attr("x", "-50%")
            .attr("y", "-50%")
            .attr("width", "200%")
            .attr("height", "200%");
        filter.append("feGaussianBlur")
            .attr("stdDeviation", "3.5")
            .attr("result", "coloredBlur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "coloredBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        // Bubbles
        g.selectAll("circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("cx", d => xScale(d.netFlowRatio))
            .attr("cy", d => yScale(d.roi))
            .attr("r", d => sizeScale(d.aii))
            .attr("fill", d => {
                if (d.chain === 'ATOM') return '#ef4444'; // Red-500
                if (d.chain === 'ATOMONE') return '#3b82f6'; // Blue-500
                return '#a855f7'; // Purple-500
            })
            .attr("fill-opacity", 0.6)
            .attr("stroke", d => d.id === selectedId ? "#fbbf24" : "rgba(255,255,255,0.4)")
            .attr("stroke-width", d => d.id === selectedId ? 2.5 : 1)
            .style("filter", d => d.id === selectedId ? "url(#glow)" : "none")
            .attr("cursor", "pointer")
            .on("click", (event, d) => {
                event.stopPropagation();
                onSelect(d.id);
            })
            .on("mouseover", function() {
                d3.select(this)
                    .transition().duration(200)
                    .attr("fill-opacity", 0.9)
                    .attr("stroke", "#fff")
                    .style("filter", "url(#glow)");
                    // Removed scale transform to keep position stable
            })
            .on("mouseout", function(event, d) {
                if (d.id !== selectedId) {
                    d3.select(this)
                        .transition().duration(200)
                        .attr("fill-opacity", 0.6)
                        .attr("stroke", "rgba(255,255,255,0.4)")
                        .style("filter", "none");
                }
            });

        // Selection Ring
        if (selectedId) {
            const selectedNode = data.find(d => d.id === selectedId);
            if (selectedNode) {
                 g.append("circle")
                    .attr("cx", xScale(selectedNode.netFlowRatio))
                    .attr("cy", yScale(selectedNode.roi))
                    .attr("r", sizeScale(selectedNode.aii) + 8)
                    .attr("fill", "none")
                    .attr("stroke", "#fbbf24")
                    .attr("stroke-width", 2)
                    .attr("opacity", 0.8)
                    .attr("pointer-events", "none")
                    .transition()
                    .duration(1500)
                    .ease(d3.easeLinear)
                    .attr("r", sizeScale(selectedNode.aii) + 20)
                    .attr("opacity", 0)
                    .on("end", function repeat() {
                        d3.select(this)
                            .attr("r", sizeScale(selectedNode.aii) + 8)
                            .attr("opacity", 0.8)
                            .transition()
                            .duration(1500)
                            .ease(d3.easeLinear)
                            .attr("r", sizeScale(selectedNode.aii) + 20)
                            .attr("opacity", 0)
                            .on("end", repeat);
                    });
            }
        }

    }, [data, selectedId]);

    return (
        <GlassCard className="flex-1 min-h-[400px] flex flex-col relative overflow-hidden p-0">
             <div ref={containerRef} className="w-full h-full relative">
                 <h3 className="text-white/40 font-bold tracking-[0.2em] text-sm absolute top-6 left-6 z-10 pointer-events-none" style={{ fontFamily: 'Space Grotesk' }}>IMPACT MAP</h3>
                 
                 {/* Legend */}
                 <div className="absolute top-6 right-6 z-10 flex gap-4 bg-[#0f172a]/80 p-2.5 rounded-xl backdrop-blur-md border border-white/10 shadow-lg">
                     <div className="flex items-center gap-2">
                         <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                         <span className="text-[10px] text-slate-300 font-medium">ATOM</span>
                     </div>
                     <div className="flex items-center gap-2">
                         <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                         <span className="text-[10px] text-slate-300 font-medium">ATOMONE</span>
                     </div>
                     <div className="flex items-center gap-2">
                         <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]"></div>
                         <span className="text-[10px] text-slate-300 font-medium">Mixed</span>
                     </div>
                 </div>

                 {/* Controls */}
                 <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2">
                     <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-slate-300 hover:text-white transition-all backdrop-blur-sm">
                         <ZoomIn size={16} />
                     </button>
                     <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-slate-300 hover:text-white transition-all backdrop-blur-sm">
                         <ZoomOut size={16} />
                     </button>
                     <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-slate-300 hover:text-white transition-all backdrop-blur-sm">
                         <Maximize size={16} />
                     </button>
                 </div>

                 <svg ref={svgRef} className="w-full h-full cursor-move" />
             </div>
        </GlassCard>
    );
};