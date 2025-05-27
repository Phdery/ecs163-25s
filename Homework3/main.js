// HW3 - Qingyue Yang

// d3.select(): Selects the DOM element with ID "vizRoot" and creates a D3 selection
const svg = d3.select("#vizRoot");
let rawData = [];
let filtered = [];
let selectedYear = null;
let currentView = "overview";
let selectedExperience = null;
let zoomBehavior = null;
// d3.zoomIdentity: Creates identity transform matrix (no zoom/pan applied)
let currentTransform = d3.zoomIdentity;

// Load data and initialize visualization
// d3.csv(): Asynchronously loads CSV file, second parameter is data transformation function
d3.csv("data/ds_salaries.csv", d => ({
  // + operator converts string values to numeric types
  year: +d.work_year,
  exp: d.experience_level,
  salary: +d.salary_in_usd,
  remote: +d.remote_ratio,
  size: d.company_size
})).then(data => {
  // .then(): Promise resolution callback executed when CSV loading completes successfully
  rawData = data;
  filtered = data;
  drawOverview();
  window.addEventListener("resize", () => {
    if (currentView === "overview") {
      drawOverview();
    } else {
      drawFocusViews();
    }
  }, {passive: true});
});

// Helper function to calculate layout dimensions based on current view state
function dims() {
  const W = window.innerWidth,
        H = window.innerHeight;
  
  if (currentView === "overview") {
    return {
      W, H,
      main: {x: 50, y: 50, w: W - 100, h: H - 100}
    };
  } else {
    const hTop = 0.4 * H;
    return {
      W, H,
      stream: {x: 0, y: 0, w: W, h: hTop},
      sankey: {x: 0, y: hTop, w: W, h: H - hTop}
    };
  }
}

// Main function to draw the overview chart with animated transitions
function drawOverview() {
  currentView = "overview";
  
  // Check if elements exist and perform smooth transition cleanup
  // svg.selectAll("*"): Selects all child elements within the SVG container
  if (svg.selectAll("*").size() > 0) {
    svg.selectAll("*")
      // .transition(): Creates a transition object for smooth animations between states
      .transition()
      // .duration(): Sets animation duration in milliseconds for transition timing
      .duration(600)
      // .style(): Sets CSS style properties, here controlling element opacity
      .style("opacity", 0)
      // .on(): Adds event listener, "end" event fires when transition animation completes
      .on("end", function(d, i) {
        if (i === 0) {
          // .remove(): Completely removes selected elements from the DOM tree
          svg.selectAll("*").remove();
          createOverviewChart();
        }
      });
  } else {
    createOverviewChart();
  }
}

// Core function to create the overview chart with complex interactions
function createOverviewChart() {
  const box = dims();
  const area = box.main;
  
  // svg.append(): Adds new child group element to SVG for organizing chart components
  const g = svg.append("g")
      // .attr(): Sets element attributes, here applying geometric transformation
      .attr("transform", `translate(${area.x},${area.y})`)
      .style("opacity", 0);

  const margin = {t: 60, r: 40, b: 80, l: 80},
        w = area.w - margin.l - margin.r,
        h = area.h - margin.t - margin.b;

  // Create inner group for chart content with margin-adjusted positioning
  const inner = g.append("g").attr("transform", `translate(${margin.l},${margin.t})`);

  // Process raw data to generate year-based statistical aggregations
  // d3.rollups(): Groups data by key function and applies aggregation function to each group
  const yearData = d3.rollups(rawData, 
    v => ({
      count: v.length,
      // d3.mean(): Calculates arithmetic mean of array values using accessor function
      avgSalary: d3.mean(v, d => d.salary),
      // d3.median(): Calculates median value of array using accessor function
      medianSalary: d3.median(v, d => d.salary),
      // d3.min(): Finds minimum value in array using accessor function
      minSalary: d3.min(v, d => d.salary),
      // d3.max(): Finds maximum value in array using accessor function
      maxSalary: d3.max(v, d => d.salary),
      year: v[0].year
    }), 
    d => d.year
  ).map(([year, stats]) => ({...stats, year}))
   .sort((a, b) => a.year - b.year);

  // Create ordinal scale for discrete x-axis positioning
  // d3.scaleBand(): Creates ordinal scale with discrete range bands for categorical data
  const x = d3.scaleBand()
      // .domain(): Sets input domain for scale using array of year values
      .domain(yearData.map(d => d.year))
      // .range(): Sets output range for scale mapping to pixel coordinates
      .range([0, w])
      // .padding(): Sets spacing between bands as fraction of bandwidth for visual separation
      .padding(0.1);

  // Create linear scale for continuous y-axis positioning
  // d3.scaleLinear(): Creates linear scale for continuous numeric data mapping
  const y = d3.scaleLinear()
      // .nice(): Extends domain to nice round numbers for cleaner axis appearance
      .domain([0, d3.max(yearData, d => d.maxSalary)]).nice()
      .range([h, 0]);

  // Configure pan and zoom behavior for interactive navigation
  // d3.zoom(): Creates zoom behavior object for handling pan/zoom interactions
  zoomBehavior = d3.zoom()
    // .scaleExtent(): Sets minimum and maximum zoom scale limits to prevent over-zooming
    .scaleExtent([0.5, 5])
    // Add event handler for zoom events to update chart transformation
    .on("zoom", (event) => {
      currentTransform = event.transform;
      // Apply zoom transform to inner chart group for pan/zoom effect
      inner.attr("transform", `translate(${margin.l + event.transform.x},${margin.t + event.transform.y}) scale(${event.transform.k})`);
    });

  // svg.call(): Invokes function with selection as 'this' context for behavior attachment
  svg.call(zoomBehavior);
  svg.call(zoomBehavior.transform, currentTransform);

  // Create bar chart elements with data binding and initial state
  // inner.selectAll(): Selects all elements matching CSS selector, creates empty selection if none exist
  const bars = inner.selectAll("rect.year-bar")
    // .data(): Binds data array to selection, establishing data-element correspondence
    .data(yearData)
    // .join(): Handles enter/update/exit pattern for data binding with automatic element creation
    .join("rect")
      .attr("class", "year-bar")
      // Use scale functions to convert data values to pixel positions
      .attr("x", d => x(d.year))
      .attr("y", h)
      // x.bandwidth(): Gets width of individual scale band for bar sizing
      .attr("width", x.bandwidth())
      .attr("height", 0)
      .attr("fill", "steelblue")
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .style("cursor", "pointer");

  // Animate bar entrance with staggered timing for visual appeal
  bars.transition()
      .duration(1000)
      // .delay(): Sets delay before animation starts, using function for staggered effect
      .delay((d, i) => i * 150)
      // .ease(): Sets easing function for animation timing curve
      .ease(d3.easeCubicOut)
      .attr("y", d => y(d.avgSalary))
      .attr("height", d => h - y(d.avgSalary));

  // Create error bars to show data range (min/max) for each year
  const errorBars = inner.selectAll("g.error-bar")
    .data(yearData)
    .join("g")
      .attr("class", "error-bar")
      .attr("transform", d => `translate(${x(d.year) + x.bandwidth()/2}, 0)`)
      .style("opacity", 0);

  // Add vertical line elements to error bar groups for range visualization
  // errorBars.append(): Adds line elements to each error bar group
  errorBars.append("line")
    .attr("y1", d => y(d.minSalary))
    .attr("y2", d => y(d.maxSalary))
    .attr("stroke", "#333")
    .attr("stroke-width", 2);

  // Add horizontal cap lines for minimum values
  errorBars.append("line")
    .attr("y1", d => y(d.minSalary))
    .attr("y2", d => y(d.minSalary))
    .attr("x1", -5).attr("x2", 5)
    .attr("stroke", "#333")
    .attr("stroke-width", 2);

  // Add horizontal cap lines for maximum values
  errorBars.append("line")
    .attr("y1", d => y(d.maxSalary))
    .attr("y2", d => y(d.maxSalary))
    .attr("x1", -5).attr("x2", 5)
    .attr("stroke", "#333")
    .attr("stroke-width", 2);

  // Animate error bars entrance with delay after main bars
  errorBars.transition()
    .duration(800)
    .delay(1200)
    .style("opacity", 0.6);

  // Add enhanced hover interactions with morphing visual effects
  bars
    // .on(): Adds event listeners for mouse interactions
    .on("mouseenter", function(event, d) {
      // Apply emphasis animation with color change and scale transformation
      // d3.select(this): Selects current element within event handler context
      d3.select(this)
        .transition()
        .duration(200)
        .attr("fill", "#ff7f0e")
        .attr("stroke", "#ff4500")
        .attr("stroke-width", 3)
        .attr("transform", `translate(${-3}, ${-3}) scale(1.05, 1.1)`);
    
      // Simultaneously highlight corresponding error bar using Common Fate principle
      // .filter(): Filters selection based on predicate function for targeted effects
      errorBars.filter(bar => bar.year === d.year)
        .transition()
        .duration(200)
        .style("opacity", 1)
        .attr("transform", `translate(${x(d.year) + x.bandwidth()/2}, 0) scale(1.2)`);
    
      // Display contextual information tooltip for data exploration
      showTooltip(event, d);
    })
    .on("mouseleave", function(event, d) {
      // Revert to default state only if not permanently selected
      if (selectedYear !== d.year) {
        d3.select(this)
          .transition()
          .duration(300)
          .attr("fill", "steelblue")
          .attr("stroke", "white")
          .attr("stroke-width", 1)
          .attr("transform", "translate(0, 0) scale(1, 1)");
        
        // Reset error bar appearance to default state
        errorBars.filter(bar => bar.year === d.year)
          .transition()
          .duration(300)
          .style("opacity", 0.6)
          .attr("transform", `translate(${x(d.year) + x.bandwidth()/2}, 0) scale(1)`);
      }
      hideTooltip();
    })
    .on("click", function(event, d) {
      // Implement permanent selection interaction for data filtering
      selectedYear = d.year;
      // Filter global dataset to selected year using Array.filter() method
      filtered = rawData.filter(row => row.year === d.year);
      
      // Execute multi-stage selection emphasis animation for clear visual feedback
      bars.transition()
          .duration(400)
          .attr("fill", bar => bar.year === d.year ? "#ff7f0e" : "lightgray")
          .attr("opacity", bar => bar.year === d.year ? 1 : 0.2)
        // Chain additional transition for scale animation staging
        .transition()
          .duration(300)
          .attr("transform", bar => bar.year === d.year ? "scale(1.1, 1.1)" : "scale(0.9, 0.9)");
      
      // Delayed transition to focus views for smooth workflow
      setTimeout(() => {
        transitionToFocusViews();
      }, 800);
    });

  // Implement brushing interaction for salary range selection
  // d3.brushY(): Creates vertical brush behavior for range selection interaction
  const brush = d3.brushY()
    // .extent(): Sets brushable area boundaries within chart coordinate system
    .extent([[w + 20, 0], [w + 60, h]])
    // Add brush event handler for dynamic data filtering
    .on("brush end", function(event) {
      if (!event.selection) {
        // Clear selection when brush is removed by user
        filtered = rawData.filter(row => selectedYear ? row.year === selectedYear : true);
        updateBarsWithBrush();
        return;
      }
      
      const [y0, y1] = event.selection;
      // .invert(): Converts pixel position back to data value using scale inversion
      const salaryRange = [y.invert(y1), y.invert(y0)];
      
      // Filter data based on brush selection range
      const baseFilter = selectedYear ? rawData.filter(row => row.year === selectedYear) : rawData;
      filtered = baseFilter.filter(d => d.salary >= salaryRange[0] && d.salary <= salaryRange[1]);
      
      updateBarsWithBrush();
    });

  // Create brush group and apply brush behavior
  // inner.append("g").call(): Creates brush group and applies brush behavior in one operation
  inner.append("g")
    .attr("class", "brush")
    .call(brush);

  // Update bar visual feedback based on brush filtering results
  function updateBarsWithBrush() {
    // Calculate and apply opacity based on filtered data proportion
    bars.transition()
      .duration(300)
      .attr("opacity", d => {
        const yearFiltered = filtered.filter(row => row.year === d.year).length;
        const yearTotal = rawData.filter(row => row.year === d.year).length;
        return 0.3 + 0.7 * (yearFiltered / yearTotal);
      });
  }

  // Add count labels with animated entrance for data context
  const labels = inner.selectAll("text.count-label")
    .data(yearData)
    .join("text")
      .attr("class", "count-label")
      .attr("x", d => x(d.year) + x.bandwidth()/2)
      .attr("y", d => y(d.avgSalary) - 5)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#333")
      .style("opacity", 0)
      .text(d => `n=${d.count}`);

  // Animate label entrance with appropriate delay
  labels.transition()
    .duration(600)
    .delay(1400)
    .style("opacity", 1);

  // Create chart axes with smooth entrance animations
  // d3.axisBottom(): Creates bottom-oriented axis generator for x-axis
  const xAxis = inner.append("g")
    .attr("transform", `translate(0,${h})`)
    .style("opacity", 0)
    // .call(): Applies axis generator to selection with custom tick formatting
    // d3.format("d"): Formats numbers as integers without decimal places
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  
  // d3.axisLeft(): Creates left-oriented axis generator for y-axis
  const yAxis = inner.append("g")
    .style("opacity", 0)
    // d3.format("~s"): Formats numbers with SI prefix notation (k, M, etc.)
    .call(d3.axisLeft(y).tickFormat(d3.format("~s")));

  // Animate axes entrance with staggered timing for visual hierarchy
  xAxis.transition().duration(800).delay(600).style("opacity", 1);
  yAxis.transition().duration(800).delay(700).style("opacity", 1);

  // Create axis labels and title with staggered entrance animations
  const axisLabels = [
    {text: "Year", x: w/2, y: h + 45, delay: 800},
    {text: "Average Salary in USD", x: -h/2, y: -50, rotation: -90, delay: 900},
    {text: "Data Science Salaries by Year (HW3 - Qingyue Yang)", x: w/2, y: -20, size: "18px", weight: "bold", delay: 1000},
    {text: "Choose a bar to get start (You can zoom or pan use the touchpad here if needed)", x: w/2, y: -5, size: "12px", color: "#666", delay: 1100}
  ];

  // Create individual axis labels with custom animations
  axisLabels.forEach(label => {
    const text = inner.append("text")
      .attr("class", "axis-label")
      .attr("x", label.x)
      .attr("y", label.y)
      .attr("text-anchor", "middle")
      .style("font-size", label.size || "14px")
      .style("font-weight", label.weight || "normal")
      .style("fill", label.color || "#000")
      .style("opacity", 0)
      .text(label.text);
    
    if (label.rotation) {
      text.attr("transform", `rotate(${label.rotation})`);
    }
    
    text.transition()
      .duration(600)
      .delay(label.delay)
      .style("opacity", 1);
  });

  // Final fade-in animation for entire overview chart
  g.transition()
    .duration(800)
    .style("opacity", 1);
}

// Execute smooth transition sequence from overview to focus views
function transitionToFocusViews() {
  // svg.selectAll("g").nodes(): Gets actual DOM nodes from D3 selection for direct manipulation
  const overview = svg.selectAll("g").nodes()[0];
  
  // Stage 1: Zoom out and fade for transition preparation
  d3.select(overview)
    .transition()
    .duration(600)
    .attr("transform", "translate(0,0) scale(0.8)")
    .style("opacity", 0.3)
    // .on("end"): Callback function executed when transition animation completes
    .on("end", () => {
      // Stage 2: Slide out animation for smooth view change
      d3.select(overview)
        .transition()
        .duration(400)
        .attr("transform", "translate(-200,0) scale(0.8)")
        .style("opacity", 0)
        .on("end", () => {
          svg.selectAll("*").remove();
          drawFocusViews();
        });
    });
}

// Create focus views with enhanced slide-in animations
function drawFocusViews() {
  currentView = "focus";
  
  const box = dims();
  
  // Create containers with initial off-screen positioning for slide-in effect
  const streamContainer = svg.append("g")
    .attr("transform", `translate(${box.W}, 0)`)
    .style("opacity", 0);
  
  const sankeyContainer = svg.append("g")
    .attr("transform", `translate(${-box.W}, ${box.stream.h})`)
    .style("opacity", 0);

  // Draw charts in containers
  drawStreamInContainer(streamContainer, box.stream);
  drawSankeyInContainer(sankeyContainer, box.sankey);
  
  // Animate containers into final position with easing
  streamContainer
    .transition()
    .duration(800)
    // d3.easeCubicOut: Easing function providing smooth deceleration curve
    .ease(d3.easeCubicOut)
    .attr("transform", `translate(0, 0)`)
    .style("opacity", 1);
  
  sankeyContainer
    .transition()
    .duration(800)
    .delay(200)
    .ease(d3.easeCubicOut)
    .attr("transform", `translate(0, ${box.stream.h})`)
    .style("opacity", 1)
    .on("end", attachBackButton);
}

// Create chord diagram showing experience-company size relationships
function drawStreamInContainer(container, area) {
  const margin = {t: 60, r: 20, b: 60, l: 60},
        w = area.w - margin.l - margin.r,
        h = area.h - margin.t - margin.b;

  // Create inner group centered for chord diagram layout
  const inner = container.append("g").attr("transform", `translate(${margin.l + w/2},${margin.t + h/2})`);

  const levels = ["EN", "MI", "SE", "EX"];
  const sizes = ["S", "M", "L"];
  const allCategories = [...levels, ...sizes];
  
  // Initialize matrix for chord diagram relationship data
  const matrix = [];
  for (let i = 0; i < allCategories.length; i++) {
    matrix[i] = new Array(allCategories.length).fill(0);
  }

  // Populate matrix with relationships between experience levels and company sizes
  filtered.forEach(d => {
    const expIndex = levels.indexOf(d.exp);
    const sizeIndex = sizes.indexOf(d.size) + levels.length;
    if (expIndex >= 0 && sizeIndex >= levels.length) {
      matrix[expIndex][sizeIndex]++;
      // Make symmetric for bidirectional flow representation
      matrix[sizeIndex][expIndex]++;
    }
  });

  // d3.chord(): Creates chord layout generator for circular network diagrams
  const chord = d3.chord()
    // .padAngle(): Sets padding angle between chord groups for visual separation
    .padAngle(0.05)
    // .sortSubgroups(): Sorts chord endpoints within groups using descending order
    .sortSubgroups(d3.descending);

  // d3.arc(): Creates arc path generator for drawing group segments
  const arc = d3.arc()
    .innerRadius(Math.min(w, h) * 0.25)
    .outerRadius(Math.min(w, h) * 0.3);

  // d3.ribbon(): Creates ribbon path generator for drawing chord connections
  const ribbon = d3.ribbon()
    .radius(Math.min(w, h) * 0.25);

  // d3.scaleOrdinal(): Creates ordinal color scale for category differentiation
  const color = d3.scaleOrdinal()
    .domain(allCategories)
    .range(["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2"]);

  // Generate chord data structure from relationship matrix
  const chords = chord(matrix);

  // Create ribbon elements representing connections between categories
  const ribbons = inner.selectAll("path.ribbon")
    .data(chords)
    .join("path")
      .attr("class", "ribbon")
      // Apply ribbon path generator to create curved connection paths
      .attr("d", ribbon)
      .attr("fill", d => color(allCategories[d.source.index]))
      .attr("opacity", 0)
      .style("cursor", "pointer");

  // Animate ribbon entrance with staggered delays for visual flow
  ribbons.transition()
    .duration(1500)
    .delay((d, i) => i * 100)
    .attr("opacity", 0.7);

  // Create group elements for category segments
  const groups = inner.selectAll("g.group")
    .data(chords.groups)
    .join("g")
      .attr("class", "group")
      .style("opacity", 0);

  // Add arc paths to group elements for category visualization
  groups.append("path")
    .attr("d", arc)
    .attr("fill", d => color(allCategories[d.index]))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  // Add text labels positioned along arc perimeter
  groups.append("text")
    .attr("dy", "0.35em")
    .attr("transform", d => {
      const angle = (d.startAngle + d.endAngle) / 2;
      const radius = Math.min(w, h) * 0.35;
      return `rotate(${(angle * 180 / Math.PI - 90)}) translate(${radius},0) ${angle > Math.PI ? "rotate(180)" : ""}`;
    })
    .attr("text-anchor", d => {
      const angle = (d.startAngle + d.endAngle) / 2;
      return angle > Math.PI ? "end" : "start";
    })
    .text(d => allCategories[d.index])
    .style("font-size", "12px")
    .style("font-weight", "bold");

  // Animate group entrance with staggered timing
  groups.transition()
    .duration(1000)
    .delay((d, i) => i * 150)
    .style("opacity", 1);

  // Add interactive hover effects for data exploration
  groups
    .on("mouseenter", function(event, d) {
      const category = allCategories[d.index];
      
      // Highlight related ribbons using opacity changes for connection emphasis
      ribbons.transition()
        .duration(200)
        .attr("opacity", ribbon => 
          (ribbon.source.index === d.index || ribbon.target.index === d.index) ? 1 : 0.1
        );
      
      // Emphasize hovered group with stroke width increase
      d3.select(this).select("path")
        .transition()
        .duration(200)
        .attr("stroke-width", 4);
      
      // Display contextual information tooltip for user guidance
      showChordTooltip(event, d, allCategories);
    })
    .on("mouseleave", function() {
      // Reset all ribbons to default opacity state
      ribbons.transition()
        .duration(200)
        .attr("opacity", 0.7);
      
      // Reset group stroke width to default
      d3.select(this).select("path")
        .transition()
        .duration(200)
        .attr("stroke-width", 2);
      
      hideTooltip();
    });

  // Create comprehensive legend system for chord diagram
  const legendContainer = container.append("g")
    .attr("class", "chord-legend")
    .attr("transform", `translate(20, ${area.h - 80})`);

  // Create experience levels legend section
  const expLegend = legendContainer.append("g")
    .attr("class", "exp-legend");

  expLegend.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("fill", "#333")
    .text("Experience Levels:");

  const expItems = expLegend.selectAll("g.exp-item")
    .data(levels)
    .join("g")
      .attr("class", "exp-item")
      .attr("transform", (d, i) => `translate(${i * 50}, 15)`)
      .style("opacity", 0);

  expItems.append("rect")
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", d => color(d))
    .attr("stroke", "#fff")
    .attr("stroke-width", 1);

  expItems.append("text")
    .attr("x", 16)
    .attr("y", 6)
    .attr("dy", "0.35em")
    .style("font-size", "10px")
    .text(d => d);

  // Create company sizes legend section
  const sizeLegend = legendContainer.append("g")
    .attr("class", "size-legend")
    .attr("transform", "translate(220, 0)");

  sizeLegend.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("fill", "#333")
    .text("Company Sizes:");

  const sizeItems = sizeLegend.selectAll("g.size-item")
    .data(sizes)
    .join("g")
      .attr("class", "size-item")
      .attr("transform", (d, i) => `translate(${i * 50}, 15)`)
      .style("opacity", 0);

  sizeItems.append("rect")
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", d => color(d))
    .attr("stroke", "#fff")
    .attr("stroke-width", 1);

  sizeItems.append("text")
    .attr("x", 16)
    .attr("y", 6)
    .attr("dy", "0.35em")
    .style("font-size", "10px")
    .text(d => d === "S" ? "Small" : d === "M" ? "Medium" : "Large");

  // Animate legend items with sequential delays for smooth appearance
  expItems.transition()
    .duration(600)
    .delay((d, i) => 2200 + i * 100)
    .style("opacity", 1);

  sizeItems.transition()
    .duration(600)
    .delay((d, i) => 2600 + i * 100)
    .style("opacity", 1);

  // Add main title with delayed entrance animation
  inner.append("text").attr("class", "title")
    .attr("x", 0).attr("y", -h/2 + 5).attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .style("font-size", "14px")
    .style("opacity", 0)
    .text(`Experience and Company Size Relationships in ${selectedYear}`)
    .transition()
    .duration(600)
    .delay(2000)
    .style("opacity", 1);

  // Add invisible subtitle for layout spacing purposes
  inner.append("text").attr("class", "subtitle")
    .attr("x", 0).attr("y", -h/2 + 25).attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#666")
    .style("opacity", 0)
    .text("Just an occupying space to avoid overlapping with the legend (and this is an easy way to do it)")
    .transition()
    .duration(600)
    .delay(2200)
    .style("opacity", 0);
}

// Create Sankey diagram container with proper layout management
function drawSankeyInContainer(container, area) {
  const margin = {t: 45, r: 20, b: 20, l: 20},
        w = area.w - margin.l - margin.r,
        h = area.h - margin.t - margin.b;

  const inner = container.append("g").attr("transform", `translate(${margin.l},${margin.t})`);

  createSankeyDiagram(inner, w, h);
}

// Create comprehensive Sankey diagram with proper cleanup and animations
function createSankeyDiagram(container, w, h) {
  // Clear existing elements to prevent overlapping visualizations
  // .selectAll().remove(): Removes all matching elements from DOM to ensure clean state
  container.selectAll("path.sankey-link").remove();
  container.selectAll("g.sankey-node").remove();
  container.selectAll("text.sankey-title").remove();

  // Filter data based on experience selection state
  const currentData = selectedExperience ? 
    filtered.filter(d => d.exp === selectedExperience) : filtered;

  if (currentData.length === 0) {
    container.append("text")
      .attr("class", "sankey-title")
      .attr("x", w/2).attr("y", h/2).attr("text-anchor", "middle")
      .style("font-size", "16px").style("fill", "#999")
      .text("No data available for selected filter");
    return;
  }

  const exps = selectedExperience ? [selectedExperience] : ["EN", "MI", "SE", "EX"];
  // [...new Set()]: Creates array of unique values by converting to Set and back to Array
  const sizes = [...new Set(currentData.map(d => d.size))];
  const rems = [...new Set(currentData.map(d => d.remote))].sort((a, b) => a - b);

  // Create node data structure for three category levels
  const nodes = [
    ...exps.map(e => ({id: "e_" + e, name: e, grp: "exp"})),
    ...sizes.map(s => ({id: "s_" + s, name: "Size " + s, grp: "size"})),
    ...rems.map(r => ({id: "r_" + r, name: r + "% Remote", grp: "rem"}))
  ];

  // Create link data structure representing flow between categories
  const links = [];
  exps.forEach(e => sizes.forEach(s => {
    const v = currentData.filter(d => d.exp === e && d.size === s).length;
    if (v) links.push({source: "e_" + e, target: "s_" + s, value: v});
  }));
  sizes.forEach(s => rems.forEach(r => {
    const v = currentData.filter(d => d.size === s && d.remote === r).length;
    if (v) links.push({source: "s_" + s, target: "r_" + r, value: v});
  }));

  if (links.length === 0) {
    container.append("text")
      .attr("class", "sankey-title")
      .attr("x", w/2).attr("y", h/2).attr("text-anchor", "middle")
      .style("font-size", "16px").style("fill", "#999")
      .text("No connections available for selected data");
    return;
  }

  // d3.sankey(): Creates Sankey diagram layout generator for flow visualization
  const sankey = d3.sankey()
      // .nodeId(): Sets node identifier accessor function for data binding
      .nodeId(d => d.id)
      // .nodeWidth(): Sets width of node rectangles in pixels
      .nodeWidth(15)
      // .nodePadding(): Sets vertical spacing between nodes in pixels
      .nodePadding(10)
      // .extent(): Sets layout boundaries for diagram positioning
      .extent([[0, 0], [w, h]]);

  // Generate Sankey layout with positioned nodes and links
  const graph = sankey({
    nodes: nodes.map(d => ({...d})), 
    links: links.map(l => ({...l}))
  });

  // Create color scale for different node group categories
  const color = d3.scaleOrdinal()
      .domain(["exp", "size", "rem"])
      .range(["#1f77b4", "#17becf", "#ff7f0e"]);

  // Create animated link paths with flowing visual effects
  const linkPaths = container.selectAll("path.sankey-link")
    .data(graph.links, d => d.source.id + "-" + d.target.id)
    // .join(): Handles enter/update/exit pattern with custom transition handlers
    .join(
      enter => enter.append("path")
        .attr("class", "sankey-link")
        // d3.sankeyLinkHorizontal(): Path generator for horizontal Sankey link curves
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke-width", d => Math.max(1, d.width))
        .attr("stroke", d => color(d.source.grp))
        .attr("fill", "none")
        .attr("opacity", 0)
        // .call(): Applies function to selection for immediate transition setup
        .call(enter => enter.transition()
          // .duration(): Sets duration for transition animations
          .duration(1200)
          // .delay(): Sets delay for transition start, creating staggered entrance effect
          .delay((d, i) => i * 100)
          // .attr(): Modifies attributes to animate link paths into view
          .attr("opacity", 0.7)),
      update => update.transition()
        .duration(800)
        .attr("stroke-width", d => Math.max(1, d.width))
        .attr("opacity", 0.7),
      exit => exit.transition()
        .duration(400)
        .attr("opacity", 0)
        .remove()
    );

  // Create animated node groups with scaling entrance effects
  const nodeGroups = container.selectAll("g.sankey-node")
    .data(graph.nodes, d => d.id)
    .join(
      enter => {
        const g = enter.append("g")
          .attr("class", "sankey-node")
          .attr("transform", d => `translate(${d.x0},${d.y0})`)
          .style("opacity", 0);
        
        // Add rectangle elements for node visualization
        g.append("rect")
          .attr("width", sankey.nodeWidth())
          .attr("height", d => d.y1 - d.y0)
          .attr("fill", d => color(d.grp))
          .attr("stroke", "#000");
        
        // Add text labels for node identification
        g.append("text")
          .attr("x", -6).attr("y", d => (d.y1 - d.y0) / 2)
          .attr("dy", "0.35em").attr("text-anchor", "end")
          .style("font-size", "11px")
          .text(d => d.name);
        
        return g.transition()
          .duration(1000)
          .delay((d, i) => i * 150)
          .style("opacity", 1);
      },
      update => update.transition()
        .duration(800)
        .attr("transform", d => `translate(${d.x0},${d.y0})`)
        .select("rect")
        .attr("height", d => d.y1 - d.y0),
      exit => exit.transition()
        .duration(400)
        .style("opacity", 0)
        .remove()
    );

  // Add descriptive title with animation
  container.append("text").attr("class", "sankey-title")
    .attr("x", w/2).attr("y", -15).attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .style("opacity", 0)
    .text(`Experience → Size → Remote in ${selectedYear}${selectedExperience ? ` (${selectedExperience} only)` : ''}`)
    .transition()
    .duration(600)
    .delay(800)
    .style("opacity", 1);

  // Create legend for Sankey diagram categories
  const sankeyLegend = container.append("g")
    .attr("class", "sankey-legend")
    .attr("transform", `translate(${w - 150}, 20)`);

  const legendData = [
    {label: "Experience", color: "#1f77b4"},
    {label: "Company Size", color: "#17becf"}, 
    {label: "Remote Work", color: "#ff7f0e"}
  ];

  const legendItems = sankeyLegend.selectAll("g.legend-item")
    .data(legendData)
    .join("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`);

  legendItems.append("rect")
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", d => d.color)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1);

  legendItems.append("text")
    .attr("x", 18)
    .attr("y", 6)
    .attr("dy", "0.35em")
    .style("font-size", "11px")
    .text(d => d.label);
}

// Update Sankey diagram when experience level is selected from chord diagram
function updateSankeyForExperience() {
  // svg.selectAll("g").nodes(): Gets second container (index 1) for Sankey diagram
  const sankeyContainer = svg.selectAll("g").nodes()[1];
  if (sankeyContainer) {
    // d3.select(): Converts DOM node back to D3 selection for manipulation
    const inner = d3.select(sankeyContainer).select("g");
    const box = dims();
    const w = box.sankey.w - 40, h = box.sankey.h - 65;
    
    // Add small delay to ensure smooth transition between states
    setTimeout(() => {
      createSankeyDiagram(inner, w, h);
    }, 100);
  }
}

// Create back button with smooth entrance animation
function attachBackButton() {
  // d3.select("body"): Selects document body for button attachment
  const button = d3.select("body").selectAll("button.back-btn")
    .data([1])
    .join("button")
      .attr("class", "back-btn")
      .style("position", "fixed")
      .style("top", "20px")
      .style("left", "20px")
      .style("padding", "10px 20px")
      .style("background", "#007bff")
      .style("color", "white")
      .style("border", "none")
      .style("border-radius", "5px")
      .style("cursor", "pointer")
      .style("font-size", "14px")
      .style("opacity", "0")
      .style("transform", "translateX(-100px)")
      .text("← Back to Overview")
      .on("click", goBackToOverview);

  // Animate button entrance with slide-in effect
  button.transition()
    .duration(600)
    .delay(400)
    .style("opacity", "1")
    .style("transform", "translateX(0px)");
}

// Handle navigation back to overview with state reset
function goBackToOverview() {
  // Reset all selection states to initial values
  selectedYear = null;
  selectedExperience = null;
  filtered = rawData;
  
  // Remove button with exit animation
  d3.select("body").selectAll("button.back-btn")
    .transition()
    .duration(300)
    .style("opacity", "0")
    .style("transform", "translateX(-100px)")
    .remove();
  
  // Execute smooth transition back to overview state
  svg.selectAll("g")
    .transition()
    .duration(600)
    .attr("transform", "translate(0, -100) scale(0.8)")
    .style("opacity", 0)
    .on("end", (d, i) => {
      if (i === 0) {
        drawOverview();
      }
    });
}

// Create tooltip for overview chart data display
function showTooltip(event, d) {
  // d3.select("body"): Selects document body for tooltip attachment
  const tooltip = d3.select("body").selectAll("div.tooltip")
    .data([1])
    .join("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0,0,0,0.9)")
      .style("color", "white")
      .style("padding", "12px")
      .style("border-radius", "8px")
      .style("pointer-events", "none")
      .style("font-size", "12px")
      .style("box-shadow", "0 4px 8px rgba(0,0,0,0.3)")
      .style("opacity", "0");

  // tooltip.html(): Sets HTML content for tooltip display
  tooltip.html(`
    <strong>Year: ${d.year}</strong><br/>
    <span style="color: #4CAF50;">Count: ${d.count} records</span><br/>
    <span style="color: #2196F3;">Avg: $${d3.format(",.0f")(d.avgSalary)}</span><br/>
    <span style="color: #FF9800;">Median: $${d3.format(",.0f")(d.medianSalary)}</span><br/>
    <span style="color: #F44336;">Range: $${d3.format(",.0f")(d.minSalary)} - $${d3.format(",.0f")(d.maxSalary)}</span>
  `)
  .style("left", (event.pageX + 15) + "px")
  .style("top", (event.pageY - 10) + "px")
  .transition()
  .duration(200)
  .style("opacity", "1");
}

// Hide tooltip with fade-out animation
function hideTooltip() {
  d3.select("body").selectAll("div.tooltip")
    .transition()
    .duration(200)
    .style("opacity", "0")
    .remove();
}

// Create tooltip for stream chart experience level data
function showStreamTooltip(event, d) {
  const tooltip = d3.select("body").selectAll("div.tooltip")
    .data([1])
    .join("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0,0,0,0.9)")
      .style("color", "white")
      .style("padding", "12px")
      .style("border-radius", "8px")
      .style("pointer-events", "none")
      .style("font-size", "12px")
      .style("box-shadow", "0 4px 8px rgba(0,0,0,0.3)")
      .style("opacity", "0");

  // Calculate total count for experience level using reduce method
  const totalCount = d.reduce((sum, point) => sum + (point[1] - point[0]), 0);

  tooltip.html(`
    <strong>Experience Level: ${d.key}</strong><br/>
    <span style="color: #4CAF50;">Total Count: ${Math.round(totalCount)} records</span><br/>
    <span style="color: #2196F3;">Click to filter Sankey diagram</span>
  `)
  .style("left", (event.pageX + 15) + "px")
  .style("top", (event.pageY - 10) + "px")
  .transition()
  .duration(200)
  .style("opacity", "1");
}

// Create specialized tooltip for chord diagram with exploration guidance
function showChordTooltip(event, d, allCategories) {
  const tooltip = d3.select("body").selectAll("div.tooltip")
    .data([1])
    .join("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0,0,0,0.9)")
      .style("color", "white")
      .style("padding", "12px")
      .style("border-radius", "8px")
      .style("pointer-events", "none")
      .style("font-size", "12px")
      .style("box-shadow", "0 4px 8px rgba(0,0,0,0.3)")
      .style("opacity", "0");

  const category = allCategories[d.index];
  const categoryType = d.index < 4 ? "Experience Level" : "Company Size";
  const categoryName = d.index < 4 ? category : (category === "S" ? "Small" : category === "M" ? "Medium" : "Large");
  
  // Calculate connection statistics for insight generation
  const connections = d.value;
  const totalConnections = filtered.length;
  const percentage = ((connections / totalConnections) * 100).toFixed(1);

  tooltip.html(`
    <strong>${categoryType}: ${categoryName}</strong><br/>
    <span style="color: #4CAF50;">Connections: ${connections} (${percentage}%)</span><br/>
  `)
  .style("left", (event.pageX + 15) + "px")
  .style("top", (event.pageY - 10) + "px")
  .transition()
  .duration(200)
  .style("opacity", "1");
}