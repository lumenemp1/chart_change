import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Plot from 'react-plotly.js';
import clsx from 'clsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, TrendingUp, Expand, Minimize2 } from 'lucide-react';

const TrendAnalysis = () => {
  const [summaryData, setSummaryData] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sourceSystem, setSourceSystem] = useState('eon');

 
  const fetchSummary = async () => {
  setIsLoading(true);
  try {
    const response = await axios.post('http://localhost:5000/analysis/summary', {
      source_system: sourceSystem, // Changed from hardcoded 'eon'
      analysis_type: 'trend_analysis'
    });
    setSummaryData(response.data);
  } catch (error) {
    console.error('Error fetching summary:', error);
  } finally {
    setIsLoading(false);
  }
};

// 3. Update the fetchDetail function (replace the existing function)
const fetchDetail = async (product, range) => {
  setIsDetailLoading(true);
  try {
    const response = await axios.post('http://localhost:5000/analysis/detail', {
      source_system: sourceSystem, // Changed from hardcoded 'eon'
      analysis_type: 'trend_analysis',
      product,
      time_range: range
    });
    setDetailData(response.data);
  } catch (error) {
    console.error('Error fetching detail:', error);
  } finally {
    setIsDetailLoading(false);
  }
};

useEffect(() => {
  fetchSummary();
}, [sourceSystem]);

  const handleProductClick = (product) => {
    setSelectedProduct(product);
    fetchDetail(product, '1m');
  };

  const handleTimeRangeChange = (range) => {
    if (selectedProduct) {
      fetchDetail(selectedProduct, range);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const renderSparkline = (data, color) => (
    <div className="h-10 w-full">
      <Plot
        data={[{
          x: data.map(d => d.date),
          y: data.map(d => d.total_orders),
          type: 'scatter',
          mode: 'lines',
          line: { color, width: 2 },
          hoverinfo: 'skip'
        }]}
        layout={{
          margin: { l: 0, r: 0, t: 0, b: 0 },
          xaxis: { visible: false },
          yaxis: { visible: false },
          height: 40,
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent'
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: '100%' }}
        key={`sparkline-${isFullscreen ? 'fs' : 'normal'}-${Date.now()}`}
      />
    </div>
  );

  const filteredData = summaryData.filter(item =>
    item.product.toLowerCase().includes(search.toLowerCase())
  );

  const containerClasses = clsx(
    "bg-background p-4 space-y-4",
    {
      "fixed inset-0 z-[9999] overflow-auto bg-white": isFullscreen,
      "min-h-screen": !isFullscreen
    }
  );

  if (selectedProduct && detailData) {
    return (
      <div className={containerClasses}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h1 className="text-4xl font-bold">📈 Product Sales Trend Dashboard</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            {isFullscreen ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Expand className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold">📊 Detailed View: {detailData.product}</h2>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedProduct(null);
              setDetailData(null);
            }}
            className="mb-4"
          >
            🔙 Back to All Products
          </Button>

          <Tabs defaultValue="1m" onValueChange={handleTimeRangeChange}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="1w">1 Week</TabsTrigger>
              <TabsTrigger value="1m">1 Month</TabsTrigger>
              <TabsTrigger value="1y">1 Year</TabsTrigger>
              <TabsTrigger value="2y">2 Years</TabsTrigger>
            </TabsList>

            {['1w', '1m', '1y', '2y'].map((timeRange) => (
              <TabsContent key={timeRange} value={timeRange} className="space-y-4">
                {isDetailLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="text-muted-foreground">Loading detailed analysis...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <h4 className="text-sm text-muted-foreground mb-1">Total Sales</h4>
                        <div className="text-2xl font-semibold">{detailData.total_sales?.toLocaleString() || 0}</div>
                      </div>
                      <div className="text-center">
                        <h4 className="text-sm text-muted-foreground mb-1">Avg Daily Sales</h4>
                        <div className="text-2xl font-semibold">{detailData.avg_sales?.toLocaleString() || 0}</div>
                      </div>
                      <div className="text-center">
                        <h4 className="text-sm text-muted-foreground mb-1">Trend</h4>
                        <div className="text-2xl font-semibold">{detailData.trend_description || 'N/A'}</div>
                        <div className={`text-sm ${detailData.trend_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {detailData.trend_percent ? `${detailData.trend_percent.toFixed(1)}% per day` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Enhanced chart container for fullscreen */}
                    <div className={clsx(
                      "bg-white px-4 pt-2 pb-1 rounded-lg border",
                      {
                        "w-full": isFullscreen,
                        "max-w-full": isFullscreen
                      }
                    )}>
                      <div className="w-full overflow-hidden">
                        <Plot
                          data={[
                            {
                              x: detailData.chart_data?.dates || [],
                              y: detailData.chart_data?.actual || [],
                              type: 'scatter',
                              mode: 'lines+markers',
                              name: 'Daily Orders',
                              line: { color: (detailData.trend_percent || 0) < 0? 'red' : 'green' ,
                                      width: 2 },
                              marker: { size: 6 }
                            },
                            
                          ]}
                          layout={{
                            title: `${detailData.product?.toUpperCase()} - ${timeRange.toUpperCase()} Analysis`,
                            xaxis: { 
                              title: {
                                text: 'Date',
                                font: { size: 14 }
                              }
                            },
                            yaxis: { 
                              title: {
                                text: 'Orders',
                                font: { size: 14 }
                              }
                            },
                            height: isFullscreen ? 450 : 400,
                            // Set width explicitly for fullscreen
                            width: isFullscreen ? window.innerWidth - 100 : undefined,
                            legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'right', x: 1 },
                            plot_bgcolor: 'white',
                            paper_bgcolor: 'white',
                            // Adjust margins for fullscreen
                            margin: isFullscreen ? { l: 60, r: 60, t: 60, b: 60 } : { l: 60, r: 60, t: 40, b: 60 }
                          }}
                          config={{ responsive: true, displayModeBar: true }}
                          style={{ 
                            width: isFullscreen ? '100%' : '100%', 
                            height: isFullscreen ? '450px' : '400px',
                            minWidth: isFullscreen ? '100%' : 'auto'
                          }}
                          key={`detail-plot-${isFullscreen ? 'fs' : 'normal'}-${timeRange}`}
                        />
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h1 className="text-4xl font-bold">📈 Product Sales Trend Dashboard</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleFullscreen}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          {isFullscreen ? (
            <Minimize2 className="h-5 w-5" />
          ) : (
            <Expand className="h-5 w-5" />
          )}
        </Button>
      </div>

       {/* ADD THE DROPDOWN HERE - RIGHT AFTER THE ABOVE DIV AND BEFORE THE NEXT DIV */}
    <div className="mb-6">
      <label htmlFor="source-system-trend" className="block text-sm font-medium text-gray-700 mb-2">
        📡 Select Source System:
      </label>
      <select
        id="source-system-trend"
        value={sourceSystem}
        onChange={(e) => {
          setSourceSystem(e.target.value);
          setIsLoading(true);
          // Reset selections when switching systems
          setSelectedProduct(null);
          setDetailData(null);
        }}
        className="block w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white"
      >
        <option value="eon">EON System</option>
        <option value="sdp">SDP System</option>
        <option value="orion">ORION System</option>
      </select>
    </div>
    {/* END OF DROPDOWN */}

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">All Product Trends [1 month]</h2>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search Product"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading product data...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredData.map((item, index) => {
            const isSelected = selectedProduct === item.product;
            return (
              <div
                key={index}
                className={clsx(
                  "border rounded-lg p-4 cursor-pointer transition-shadow bg-white",
                  {
                    "ring-2 ring-primary bg-blue-50": isSelected,
                    "opacity-50": selectedProduct && !isSelected
                  }
                )}
                title={item.product}
                onClick={() => handleProductClick(item.product)}
              >
                <div className="truncate font-semibold text-base mb-1">{item.product}</div>
                <div className="text-sm text-muted-foreground mb-1">
                  📦 Total Sales: {item.total_sales?.toLocaleString() || 0}
                </div>
                <div className="text-sm font-medium mb-2">
                  {item.trend_icon} {item.trend_description} ({item.trend_percent.toFixed(1)}%)
                </div>
                {item.sparkline_data && renderSparkline(item.sparkline_data, item.color)}
              </div>
            );
          })}
        </div>
      )}

      {filteredData.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">No products found</h3>
          <p className="text-muted-foreground">Try adjusting your search terms</p>
        </div>
      )}
    </div>
  );
};

export default TrendAnalysis;
