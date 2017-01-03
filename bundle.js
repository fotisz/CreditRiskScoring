// Entry point for interactive diagrams.
function main() {

  // Set values of true positives vs. false positives.
  var tprValue = 300;
  var fprValue = -700;

  // Parameters for main model comparison.
  var s0 = 10; // standard deviations of defaulters/payers.
  var s1 = 10;
  var d0 = 8;  // differences from means of defaulters/payers
  var d1 = 12;
  var m0 = 55; // means of overall distributions
  var m1 = 45;

  // Create items to classify: two groups with different
  // distributions of positive/negative examples.
  comparisonExample0 = new GroupModel(makeNormalItems(0, 1, 100, m0 + d0, s0)
      .concat(makeNormalItems(0, 0, 100, m0 - d0, s0)), tprValue, fprValue);
  comparisonExample1 = new GroupModel(makeNormalItems(1, 1, 100, m1 + d1, s1)
      .concat(makeNormalItems(1, 0, 100, m1 - d1, s1)), tprValue, fprValue);

  // Make a model to represent initial example of classification.
  var singleModel = new GroupModel(makeNormalItems(0, 1, 100, 60, 10)
      .concat(makeNormalItems(0, 0, 100, 40, 10)), tprValue, fprValue);

  // Make models to represent different distributions.
  var distributionExample0 = new GroupModel(makeNormalItems(0, 1, 150, 70, 7)
      .concat(makeNormalItems(0, 0, 150, 30, 7)), tprValue, fprValue);
  var distributionExample1 = new GroupModel(makeNormalItems(0, 1, 150, 60, 10)
      .concat(makeNormalItems(0, 0, 150, 40, 10)), tprValue, fprValue);


  // Need to classify to get colors to look right on histogram.
  distributionExample0.classify(0);
  distributionExample1.classify(0);

  // Create optimizer for models.
  var optimizer = Optimizer(comparisonExample0, comparisonExample1, 1);

  // Buttons to activate different classification strategies.
  document.getElementById('group-unaware').onclick = optimizer.groupUnaware;
  document.getElementById('max-profit').onclick = optimizer.maximizeProfit;
  document.getElementById('demographic-parity').onclick =
      optimizer.demographicParity;
  document.getElementById('equal-opportunity').onclick =
      optimizer.equalOpportunity;

  // Make correctness matrices.
  createCorrectnessMatrix('single-correct0', singleModel);
  createCorrectnessMatrix('correct0', comparisonExample0);
  createCorrectnessMatrix('correct1', comparisonExample1);

  // Make histograms.
  createHistogram('plain-histogram0', distributionExample0, true);
  createHistogram('plain-histogram1', distributionExample1, true);
  createHistogram('single-histogram0', singleModel);
  createHistogram('histogram0', comparisonExample0, false, true);
  createHistogram('histogram1', comparisonExample1, false, true);

  // Add legends.
  createSimpleHistogramLegend('plain-histogram-legend0', 0);
  createSimpleHistogramLegend('plain-histogram-legend1', 0);
  createHistogramLegend('histogram-legend0', 0);
  createHistogramLegend('single-histogram-legend0', 0);
  createHistogramLegend('histogram-legend1', 1);

  // Create pie charts
  createRatePies('single-pies0', singleModel, PIE_COLORS[0]);
  createRatePies('pies0', comparisonExample0, PIE_COLORS[0], true);
  createRatePies('pies1', comparisonExample1, PIE_COLORS[1], true);

  function updateTextDisplays(event) {
    // Update number readouts.
    function display(id, value) {
      var element = document.getElementById(id);
      element.innerHTML = '' + value;
      element.style.color = value < 0 ? '#f00' : '#000';
    }
    display('single-profit0', singleModel.profit);
    display('profit0', comparisonExample0.profit);
    display('profit1', comparisonExample1.profit);
    display('total-profit', comparisonExample0.profit +
        comparisonExample1.profit);

    // Update micro-story annotations.
    function annotate(id) {
      var annotations = document.getElementsByClassName(id + '-annotation');
      for (var i = 0; i < annotations.length; i++) {
        annotations[i].style.visibility = id == event ? 'visible' : 'hidden';
        annotations[i].style.display = id == event ? 'block' : 'none';
      }
    }
    // Annotate each of the criteria defined by our optimizer.
    annotate(MAX_PROFIT);
    annotate(GROUP_UNAWARE);
    annotate(DEMOGRAPHIC_PARITY);
    annotate(EQUAL_OPPORTUNITY);
  }

  // Update text whenever any of the interactive models change.
  singleModel.addListener(updateTextDisplays);
  comparisonExample0.addListener(updateTextDisplays);
  comparisonExample1.addListener(updateTextDisplays);

  // Initialize everything.
  comparisonExample0.classify(50);
  comparisonExample1.classify(50);
  singleModel.classify(50);
  singleModel.notifyListeners();
  comparisonExample0.notifyListeners();
  comparisonExample1.notifyListeners();
}

// Models for threshold classifiers
// along with simple optimization code.

// An item with an intrinsic value, predicted classification, and
// a "score" for use by a threshold classifier.
// The going assumption is that the values and predicted values
// are 0 or 1. Furthermore "1" is considered a positive/good value.
var Item = function(category, value, score) {
  this.category = category;
  this.value = value;
  this.predicted = value;
  this.score = score;
};


// A group model defines a group of items, with a threshold
// for a classifier and associated values for true and
// false positives. It also can notify listeners that an event
// has occurred to change the model.
var GroupModel = function(items, tprValue, fprValue) {
  // Data defining the model.
  this.items = items;
  this.tprValue = tprValue;
  this.fprValue = fprValue;
  // Observers of the model; needed for interactive diagrams.
  this.listeners = [];
};

// Classify according to the given threshold, and store various
// interesting metrics for future use.
GroupModel.prototype.classify = function(threshold) {
  this.threshold = threshold;

  // Classify and find positive rates.
  var totalGood = 0;
  var totalPredictedGood = 0;
  var totalGoodPredictedGood = 0;
  this.items.forEach(function(item) {
    item.predicted = item.score >= threshold ? 1 : 0;
  });
  this.tpr = tpr(this.items);
  this.positiveRate = positiveRate(this.items);

  // Find profit.
  this.profit = profit(this.items, this.tprValue, this.fprValue);
};

// GroupModels follow a very simple observer pattern; they
// have listeners which can be notified of arbitrary events.
GroupModel.prototype.addListener = function(listener) {
  this.listeners.push(listener);
};

// Tell all listeners of the specified event.
GroupModel.prototype.notifyListeners = function(event) {
  this.listeners.forEach(function(listener) {listener(event);});
};

// Create items whose scores have a
// "deterministic normal" distribution. That is, the items track
// a Gaussian curve. This not the same as actually choosing scores
// normally, but for expository purposes it's useful to have
// deterministic, smooth distributions of values.
function makeNormalItems(category, value, n, mean, std) {
  var items = [];
  var error = 0;
  for (var score = 0; score < 100; score++) {
    var e = error + n * Math.exp(-(score - mean) * (score - mean) / (2 * std * std)) /
            (std * Math.sqrt(2 * Math.PI));
    var m = Math.floor(e);
    error = e - m;
    for (var j = 0; j < m; j++) {
      items.push(new Item(category, value, score));
    }
  }
  return items;
}


// Profit of a model, subject to the given values
// for true and false positives. Note that the simple model
// in the paper assumes zero value for negatives.
function profit(items, tprValue, fprValue) {
  var sum = 0;
  items.forEach(function(item) {
    if (item.predicted == 1) {
      sum += item.value == 1 ? tprValue : fprValue;
    }
  });
  return sum;
}

// Count specified type of items.
function countMatches(items, value, predicted) {
  var n = 0;
  items.forEach(function(item) {
    if (item.value == value && item.predicted == predicted) {
      n++;
    }
  });
  return n;
}

// Calculate true positive rate
function tpr(items) {
  var totalGood = 0;
  var totalGoodPredictedGood = 0;
  items.forEach(function(item) {
    totalGood += item.value;
    totalGoodPredictedGood += item.value * item.predicted;
  });
  if (totalGood == 0) {
    return 1;
  }
  return totalGoodPredictedGood / totalGood;
}

// Calculate overall positive rate
function positiveRate(items) {
  var totalGood = 0;
  items.forEach(function(item) {
    totalGood += item.predicted;
  });
  return totalGood / items.length;
}


// Constants for types of optimization.
var MAX_PROFIT = 'max-profit';
var GROUP_UNAWARE = 'group-unaware';
var DEMOGRAPHIC_PARITY = 'demographic-parity';
var EQUAL_OPPORTUNITY = 'equal-opportunity';

// Returns an object with four functions representing the four
// ways to optimize between two models that are described
// in the blog post.
function Optimizer(model0, model1, stepSize) {
  function classify(t0, t1) {
    model0.classify(t0);
    model1.classify(t1);
    return model0.profit + model1.profit;
  }

  // Get extents of item scores, and use for range of search.
  function getScore(item) {return item.score;}
  var extent0 = d3.extent(model0.items, getScore);
  var extent1 = d3.extent(model1.items, getScore);
  // Add to max value to include possibility of all-negative threshold.
  extent0[1] += stepSize;
  extent1[1] += stepSize;

  // Maximize utility according to the given constraint.
  // The constraint function takes the two thresholds as arguments.
  // Although an exhautive search works fine here, note that there
  // is a huge amount of room for optimization. See paper by Hardt et al.
  // for additional algorithmic discussion.
  function maximizeWithConstraint(constraint, event) {
    var maxProfit = -Infinity;
    var bestT0;
    var bestT1;
    for (var t0 = extent0[0]; t0 <= extent0[1]; t0 += stepSize) {
      for (var t1 = extent1[0]; t1 <= extent1[1]; t1 += stepSize) {
        var p = classify(t0, t1);
        if (!constraint(t0, t1)) {continue;}
        if (p > maxProfit) {
          maxProfit = p;
          bestT0 = t0;
          bestT1 = t1;
        }
      }
    }
    classify(bestT0, bestT1);
    model0.notifyListeners(event);
    model1.notifyListeners(event);
  }
  // Given our set-up, we can't always hope for exact equality
  // of various ratios.
  // We test for two numbers to be close enough that they look
  // the same when formatted for display.
  // This is not technically optimal mathematically but definitely
  // optimal pedagogically!
  function approximatelyEqual(x, y) {
    return Math.round(100 * x) == Math.round(100 * y);
  }

  // Return a bundle of optimizer functiond,
  return {
    // Maximize utility, allowing any combination of thresholds.
    maximizeProfit: function() {
      maximizeWithConstraint(function() {return true;}, MAX_PROFIT);
    },
    // Group unware: thresholds must be equal in both groups.
    groupUnaware: function() {
      maximizeWithConstraint(function(t0, t1) {
        return t0 == t1;
      }, GROUP_UNAWARE);
    },
    // Demographic parity: true + false positive rates must be the same.
    demographicParity: function() {
      maximizeWithConstraint(function(t0, t1) {
        var pr0 = positiveRate(model0.items);
        var pr1 = positiveRate(model1.items);
        return approximatelyEqual(pr0, pr1);
      }, DEMOGRAPHIC_PARITY);
    },
    // Equal opportunity: true positive rates must be the same.
    equalOpportunity: function() {
    maximizeWithConstraint(function(t0, t1) {
        var tpr0 = tpr(model0.items);
        var tpr1 = tpr(model1.items);
        return approximatelyEqual(tpr0, tpr1);
      }, EQUAL_OPPORTUNITY);
    }
  };
}

// Interactive diagrams for fairness demo.
// These are lightweight components customized
// for this demo.

// Side of grid in histograms and correctness matrices.
var SIDE = 7;

// Component dimensions.
var HEIGHT = 250;
var HISTOGRAM_WIDTH = 370;
var HISTOGRAM_LEGEND_HEIGHT = 60;

// Histogram bucket width
var HISTOGRAM_BUCKET_SIZE = 2;

// Padding on left; needed within SVG so annotations show up.
var LEFT_PAD = 10;

// Palette constants and functions.

// Colors of categories of items.
var CATEGORY_COLORS = ['#039', '#c70'];

// Colors for pie slices; set by hand because of various tradeoffs.
// Order:  false negative, true negative, true positive, false positive.
var PIE_COLORS = [['#686868', '#ccc','#039', '#92a5ce'],
                  ['#686868', '#ccc','#c70',  '#f0d6b3']];

function itemColor(category, predicted) {
  return predicted == 0 ? '#555' : CATEGORY_COLORS[category];
}

function itemOpacity(value) {
  return .3 + .7 * value;
}

function iconColor(d) {
  return d.predicted == 0 && !d.colored ? '#555' : CATEGORY_COLORS[d.category];
}

function iconOpacity(d) {
  return itemOpacity(d.value);
}

// Icon for a person in histogram or correctness matrix.
function defineIcon(selection) {
  selection
    .attr('class', 'icon')
    .attr('stroke', iconColor)
    .attr('fill', iconColor)
    .attr('fill-opacity', iconOpacity)
    .attr('stroke-opacity', function(d) {return .4 + .6 * d.value;})
    .attr('cx', function(d) {return d.x + d.side / 2;})
    .attr('cy', function(d) {return d.y + d.side / 2;})
    .attr('r', function(d) {return d.side * .4});
}

function createIcons(id, items, width, height, pad) {
  var svg = d3.select('#' + id).append('svg')
    .attr('width', width)
    .attr('height', height);
  if (pad) {
    svg = svg.append('g').attr('transform', 'translate(' + pad + ',0)');
  }
  var icon = svg.selectAll('.icon')
    .data(items)
  .enter().append('circle')
    .call(defineIcon);
  return svg;
}

function gridLayout(items, x, y) {
  items = items.reverse();
  var n = items.length;
  var cols = 15;
  var rows = Math.ceil(n / cols);
  items.forEach(function(item, i) {
    item.x = x + SIDE * (i % cols);
    item.y = y + SIDE * Math.floor(i / cols);
    item.side = SIDE;
  });
}

// Shallow copy of item array.
function copyItems(items) {
  return items.map(function(item) {
    var copy = new Item(item.category, item.value, item.score);
    copy.predicted = item.predicted;
    return copy;
  });
}

// Create histogram for scores of items in a model.
function createHistogram(id, model, noThreshold, includeAnnotation) {
  var width = HISTOGRAM_WIDTH;
  var height = HEIGHT;
  var bottom = height - 16;

  // Create an internal copy.
  var items = copyItems(model.items);

  // Icons
  var numBuckets = 100 / HISTOGRAM_BUCKET_SIZE;
  var pedestalWidth = numBuckets * SIDE;
  var hx = (width - pedestalWidth) / 2;
    var scale = d3.scale.linear().range([hx, hx + pedestalWidth]).
      domain([0, 100]);

  function histogramLayout(items, x, y, side, low, high, bucketSize) {
    var buckets = [];
    var maxNum = Math.floor((high - low) / bucketSize);
    items.forEach(function(item) {
      var bn = Math.floor((item.score - low) / bucketSize);
      bn = Math.max(0, Math.min(maxNum, bn));
      buckets[bn] = 1 + (buckets[bn] || 0);
      item.x = x + side * bn;
      item.y = y - side * buckets[bn];
      item.side = side;
    });
  }

  histogramLayout(items, hx, bottom, SIDE, 0, 100, HISTOGRAM_BUCKET_SIZE);
  var svg = createIcons(id, items, width, height);

  var tx = width / 2;
  var topY = 60;
    var axis = d3.svg.axis().scale(scale);
  svg.append('g').attr('class', 'histogram-axis')
    .attr('transform', 'translate(0,-8)')
    .call(axis);
  d3.select('.domain').attr('stroke-width', 1);

  if (noThreshold) {
    return;
  }
  // Sliding threshold bar.
  var cutoff = svg.append('rect').attr('x', tx - 2).attr('y', topY - 10).
      attr('width', 3).attr('height', height - topY);

  var thresholdLabel = svg.append('text').text('loan threshold: 50')
      .attr('x', tx)
      .attr('y', 40)
      .attr('text-anchor', 'middle').attr('class', 'bold-label');

  if (includeAnnotation) {
    var annotationPad = 10;
    var annotationW = 200;
    var thresholdAnnotation = svg.append('rect')
        .attr('class', 'annotation group-unaware-annotation')
        .attr('x', tx - annotationW / 2)
        .attr('y', 30 - annotationPad)
        .attr('rx', 20)
        .attr('ry', 20)
        .attr('width', annotationW)
        .attr('height', 30);
   }

  function setThreshold(t, eventFromUser) {
    t = Math.max(0, Math.min(t, 100));
    if (eventFromUser) {
      t = HISTOGRAM_BUCKET_SIZE * Math.round(t / HISTOGRAM_BUCKET_SIZE);
    } else {
      tx = Math.round(scale(t));
    }
    tx = Math.max(0, Math.min(width - 4, tx));
    var rounded = SIDE * Math.round(tx / SIDE);
    cutoff.attr('x', rounded);
    var labelX = Math.max(50, Math.min(rounded, width - 70));
    thresholdLabel.attr('x', labelX).text('loan threshold: ' + t);
    if (includeAnnotation) {
      thresholdAnnotation.attr('x', tx - annotationW / 2);
    }
    svg.selectAll('.icon').call(defineIcon);
  }
  var drag = d3.behavior.drag()
    .on('drag', function() {
      var oldTx = tx;
      tx += d3.event.dx;
      var t = scale.invert(tx);
      setThreshold(t, true);
      if (tx != oldTx) {
        model.classify(t);
        model.notifyListeners('histogram-drag');
      }
  });
  svg.call(drag);
  model.addListener(function(event) {
    for (var i = 0; i < items.length; i++) {
      items[i].predicted = items[i].score >= model.threshold ? 1 : 0;
    }
    setThreshold(model.threshold, event == 'histogram-drag');
  });
}

// Draw full legend for histogram, with all four possible
// categories of people.
function createHistogramLegend(id, category) {
  var width = HISTOGRAM_WIDTH;
  var height = HISTOGRAM_LEGEND_HEIGHT;
  var centerX = width / 2;
  var boxSide = 16;
  var centerPad = 1;

  // Create SVG.
  var svg = d3.select('#' + id).append('svg')
    .attr('width', width)
    .attr('height', height);

  // Create boxes.
  svg.append('rect').attr('width', boxSide).attr('height', boxSide)
    .attr('x', centerX - boxSide - centerPad).attr('y', boxSide)
    .attr('fill', itemColor(category, 0))
    .attr('fill-opacity', itemOpacity(1));
  svg.append('rect').attr('width', boxSide).attr('height', boxSide)
    .attr('x', centerX + centerPad).attr('y', boxSide)
    .attr('fill', itemColor(category, 1))
    .attr('fill-opacity', itemOpacity(1));

  svg.append('rect').attr('width', boxSide).attr('height', boxSide)
    .attr('x', centerX - boxSide - centerPad).attr('y', 0)
    .attr('fill', itemColor(category, 0))
    .attr('fill-opacity', itemOpacity(0));
  svg.append('rect').attr('width', boxSide).attr('height', boxSide)
    .attr('x', centerX + centerPad).attr('y', 0)
    .attr('fill', itemColor(category, 1))
    .attr('fill-opacity', itemOpacity(0));

  // Draw text.
  var textPad = 4;
  svg.append('text')
      .text('denied loan / would pay back')
      .attr('x', centerX - boxSide - textPad)
      .attr('y', 2 * boxSide - textPad)
      .attr('text-anchor', 'end')
      .attr('class', 'legend-label');
  svg.append('text')
      .text('denied loan / would default')
      .attr('x', centerX - boxSide - textPad)
      .attr('y', boxSide - textPad)
      .attr('text-anchor', 'end')
      .attr('class', 'legend-label');
  svg.append('text')
      .text('granted loan / pays back')
      .attr('x', centerX + boxSide + textPad)
      .attr('y', 2 * boxSide - textPad)
      .attr('text-anchor', 'start')
      .attr('class', 'legend-label');
  svg.append('text')
      .text('granted loan / defaults')
      .attr('x', centerX + boxSide + textPad)
      .attr('y', boxSide - textPad)
      .attr('text-anchor', 'start')
      .attr('class', 'legend-label');
}

// A much simpler legend, used in the top diagram,
// with only two categories of people and a different layout.
function createSimpleHistogramLegend(id, category) {
  var width = HISTOGRAM_WIDTH;
  var height = HISTOGRAM_LEGEND_HEIGHT;
  var centerX = width / 2;
  var boxSide = 16;
  var centerPad = 1;
  var lx = 50;

  // Create SVG.
  var svg = d3.select('#' + id).append('svg')
    .attr('width', width)
    .attr('height', height);

  // Create boxes.
  svg.append('rect').attr('width', boxSide).attr('height', boxSide)
    .attr('x', centerX + centerPad).attr('y', 0)
    .attr('fill', itemColor(category, 1))
    .attr('fill-opacity', itemOpacity(1));
  svg.append('rect').attr('width', boxSide).attr('height', boxSide)
    .attr('x', lx).attr('y', 0)
    .attr('fill', itemColor(category, 1))
    .attr('fill-opacity', itemOpacity(0));

  // Draw text.
  var textPad = 4;
  svg.append('text')
      .text('would pay back loan')
      .attr('x', centerX + boxSide + textPad)
      .attr('y', boxSide - textPad)
      .attr('text-anchor', 'start')
      .attr('class', 'legend-label');
  svg.append('text')
      .text('would default on loan')
      .attr('x', lx + boxSide + textPad)
      .attr('y', boxSide - textPad)
      .attr('text-anchor', 'start')
      .attr('class', 'legend-label');
}

// Create a pie chart.
function createPie(id, values, colors, svg, ox, oy, radius) {
  var angles = [];
  function makeAngles(values) {
    var total = 0;
    for (var i = 0; i < values.length; i++) {
      total += values[i];
    }
    var sum = 0;
    for (var i = 0; i < values.length; i++) {
      var start = 2 * Math.PI * sum / total;
      sum += values[i];
      var end = 2 * Math.PI * sum / total;
      angles[i] = [start, end];
    }
  }
  makeAngles(values);
  var slices = svg.selectAll('.slice-' + id);
  function makeArc(d) {
    return d3.svg.arc()
      .innerRadius(0)
      .outerRadius(radius)
      .startAngle(d[0]).endAngle(d[1])();
  }
  slices.data(angles).enter().append('path')
    .attr('class', 'slice-' + id)
    .attr('d', makeArc)
    .attr('fill', function(d, i) {return colors[i]})
    .attr('transform', 'translate(' + ox + ',' + oy + ')');
  return function(newValues) {
    makeAngles(newValues);
    svg.selectAll('.slice-' + id)
        .data(angles)
        .attr('d', makeArc);
  }
}

// Create a nice label for percentages; the return value is a callback
// to update the number.
function createPercentLabel(svg, x, y, text, labelClass, statClass) {
  var label = svg.append('text').text(text)
      .attr('x', x).attr('y', y).attr('class', labelClass);
  var labelWidth = label[0][0].getComputedTextLength();
  var stat = svg.append('text').text('')
      .attr('x', x + labelWidth + 4).attr('y', y).attr('class', statClass);

  // Return a function that updated the label.
  return function(value) {
    var formattedValue = Math.round(100 * value) + '%';
    stat.text(formattedValue);
  }
}

// Helper for multiline explanations.
function explanation(svg, lines, x, y) {
  lines.forEach(function(line) {
    svg.append('text').text(line)
        .attr('x', x).attr('y', y += 16).attr('class', 'explanation');
  });
}

// Create two pie charts: 1. for all classification rates
// and 2. true positive rates.
function createRatePies(id, model, palette, includeAnnotations) {
  var width = 300;
  var lx = 0;
  var height = 170;
  var svg = d3.select('#' + id).append('svg')
    .attr('width', width)
    .attr('height', height);
  // Add a little margin so the annotation rectangle
  // around "True Positive Rate" doesn't get cut off.
  svg = svg.append('g').attr('transform', 'translate(10,0)');
  var tprColors = [palette[0], palette[2]];
  var cy = 120;
  var tprPie = createPie('tpr-' + id, [1,1], tprColors, svg, 45, cy, 40);
  var allPie = createPie('all-' + id, [1,1,1,1], palette, svg, 195, cy, 40);
  var topY = 35;

  var tprLabel = createPercentLabel(svg, lx, topY, 'True Positive Rate',
      'pie-label', 'pie-number');
  var posLabel = createPercentLabel(svg, width / 2, topY, 'Positive Rate',
      'pie-label', 'pie-number');

  // Add annotation labels, if requested:
  if (includeAnnotations) {
    var tprAnnotation = svg.append('rect')
        .attr('class', 'annotation equal-opportunity-annotation')
        .attr('x', -8)
        .attr('y', 14)
        .attr('rx', 20)
        .attr('ry', 20)
        .attr('width', width / 2 - 10)
        .attr('height', 30);
    var posAnnotation = svg.append('rect')
        .attr('class', 'annotation demographic-parity-annotation')
        .attr('x', width / 2 - 10)
        .attr('y', 14)
        .attr('rx', 20)
        .attr('ry', 20)
        .attr('width', width / 2 - 30)
        .attr('height', 30);
  }

  // Add explanations of positive rates
  explanation(svg, ['percentage of paying',
     'applications getting loans'], 0, topY);
  explanation(svg, ['percentage of all',
     'applications getting loans'], width / 2 + 4, topY);

  model.addListener(function() {
    var items = model.items;
    tprPie([countMatches(items, 1, 0),
            countMatches(items, 1, 1)]);
    allPie([countMatches(items, 1, 0), countMatches(items, 0, 0),
            countMatches(items, 1, 1), countMatches(items, 0, 1)]);
    tprLabel(model.tpr);
    posLabel(model.positiveRate);
  });
}

// Creates matrix view of dots representing correct and
// incorrect items.
function createCorrectnessMatrix(id, model) {
  var width = 300;
  var height = 170;
  var correct, incorrect;
  function layout() {
    correct = model.items.filter(function(item) {
      return item.value == item.predicted;
    });
    incorrect = model.items.filter(function(item) {
      return item.value != item.predicted;
    });
    gridLayout(correct, 2, 80);
    gridLayout(incorrect, width / 2 + 4, 80);
  }

  layout();
  var svg = createIcons(id, model.items, width, height, LEFT_PAD);

  var topY = 18;
  var correctLabel = createPercentLabel(svg, 0, topY, 'Correct',
      'pie-label', 'pie-number');
  var incorrectLabel = createPercentLabel(svg, width / 2 + 4, topY, 'Incorrect',
      'pie-label', 'pie-number');

  // Add explanation of correct decisions.
  explanation(svg, ['loans granted to paying',
      'applicants and denied', 'to defaulters'], 0, topY);
  explanation(svg, ['loans denied to paying',
      'applicants and granted', 'to defaulters'], width / 2 + 4, topY);

  // Add explanation of incorrect
  model.addListener(function() {
    layout();
    correctLabel(correct.length / model.items.length);
    incorrectLabel(incorrect.length / model.items.length);
    svg.selectAll('.icon').call(defineIcon);
  });
}
