# Requirements Document

## Introduction

The Load Diagram Generator is an add-on tool for PTV OptiFlow that automates the creation of visual trailer loading plans from Excel-based line-item data. Warehouse planners upload an Excel file containing item dimensions, weights, and constraints; the system processes this data through a 3D bin-packing algorithm and produces a printable/distributable loading diagram showing exact pallet placement, load sequence, and spatial arrangement within the trailer. The goal is to maximize trailer capacity utilization, enforce real-world constraints (stackability, weight distribution, axle limits), and give warehouse teams clear, visual loading instructions.

## Glossary

- **Load_Diagram_Generator**: The core system that orchestrates the end-to-end workflow from file upload through optimization to diagram output.
- **Excel_Parser**: The subsystem responsible for reading and validating uploaded Excel files containing load item data.
- **Packing_Engine**: The optimization subsystem that computes optimal 3D placement of items/pallets within a trailer using bin-packing algorithms.
- **Diagram_Renderer**: The subsystem that produces visual output (2D top-down views, side views, and optional 3D representations) of the computed load plan.
- **Trailer_Profile**: A configuration object defining a trailer's internal dimensions (length, width, height), maximum payload weight, axle positions, and axle weight limits.
- **Load_Item**: A single line item from the uploaded Excel file representing a physical unit to be loaded (carton, pallet, or unit load).
- **Load_Plan**: The computed result containing the placement coordinates, orientation, and loading sequence for all items within a trailer.
- **Stackability_Rule**: A constraint defining which items may be placed on top of other items, based on weight tolerance, fragility, or product category.
- **Weight_Distribution**: The calculated balance of weight across the trailer's length and width, ensuring compliance with axle weight limits and safe transport.
- **Load_Sequence**: The order in which items should be physically loaded into the trailer, typically reverse of delivery sequence (last delivery loaded first).
- **Planner**: The user role responsible for uploading data, configuring trailer profiles, reviewing load plans, and distributing diagrams to the warehouse team.
- **Warehouse_Operator**: The end recipient of the printed/distributed load diagram who physically loads the trailer according to the plan.

## Requirements

### Requirement 1: Excel File Upload and Validation

**User Story:** As a Planner, I want to upload an Excel file containing load item data, so that the system can automatically process my shipment details without manual data entry.

#### Acceptance Criteria

1. WHEN a Planner uploads an Excel file, THE Excel_Parser SHALL accept files in .xlsx and .xls format up to 10MB in size.
2. WHEN a valid Excel file is uploaded, THE Excel_Parser SHALL extract item records containing: item ID, description, length (mm), width (mm), height (mm), weight (kg), quantity, stackability class, and delivery stop number.
3. IF an uploaded file is missing required columns, THEN THE Excel_Parser SHALL return a validation error listing all missing column names.
4. IF an uploaded file contains rows with invalid data types or out-of-range values, THEN THE Excel_Parser SHALL flag each invalid row with a specific error description and row number.
5. WHEN validation completes successfully, THE Excel_Parser SHALL display a summary showing total item count, total weight, and total volume to the Planner for confirmation.

### Requirement 2: Trailer Profile Configuration

**User Story:** As a Planner, I want to define and select trailer profiles with real dimensions and constraints, so that load plans respect the physical limits of the actual vehicles being used.

#### Acceptance Criteria

1. THE Load_Diagram_Generator SHALL allow the Planner to create Trailer_Profile records containing: internal length (mm), internal width (mm), internal height (mm), maximum payload weight (kg), number of axles, and axle weight limits (kg per axle).
2. THE Load_Diagram_Generator SHALL provide a library of pre-configured Trailer_Profile templates for common European trailer types (standard 13.6m curtainsider, box trailer, mega trailer).
3. WHEN a Planner selects a Trailer_Profile, THE Load_Diagram_Generator SHALL use that profile's dimensions and constraints for all subsequent packing calculations.
4. WHERE a Planner requires custom door placement, THE Load_Diagram_Generator SHALL allow configuration of rear-door and side-door loading positions on the Trailer_Profile.

### Requirement 3: 3D Bin-Packing Optimization

**User Story:** As a Planner, I want the system to compute an optimal loading arrangement automatically, so that trailer capacity is maximized and all physical constraints are respected.

#### Acceptance Criteria

1. WHEN a Load_Plan computation is triggered, THE Packing_Engine SHALL place all Load_Items within the selected Trailer_Profile boundaries without exceeding length, width, or height limits.
2. THE Packing_Engine SHALL maximize volume utilization of the trailer, targeting a minimum of 85% volume fill rate when geometrically feasible.
3. WHILE computing placement, THE Packing_Engine SHALL enforce Stackability_Rules such that no item receives load exceeding its declared maximum stack weight.
4. WHILE computing placement, THE Packing_Engine SHALL maintain Weight_Distribution within axle weight limits defined in the Trailer_Profile.
5. WHEN multiple delivery stops exist, THE Packing_Engine SHALL arrange items in reverse delivery sequence so that the first delivery stop items are loaded last (nearest to trailer doors).
6. THE Packing_Engine SHALL complete Load_Plan computation for up to 200 Load_Items within 30 seconds on a standard workstation.
7. IF the Packing_Engine cannot fit all Load_Items within a single trailer, THEN THE Packing_Engine SHALL report the overflow items and suggest splitting into multiple trailers.

### Requirement 4: Visual Load Diagram Output

**User Story:** As a Planner, I want to receive a clear visual diagram of the load plan, so that I can distribute it to the warehouse team as loading instructions.

#### Acceptance Criteria

1. WHEN a Load_Plan is computed, THE Diagram_Renderer SHALL generate a top-down (bird's eye) view showing all item placements with labeled item IDs and dimensions.
2. WHEN a Load_Plan is computed, THE Diagram_Renderer SHALL generate a side-view (profile) showing vertical stacking and height utilization.
3. THE Diagram_Renderer SHALL color-code items by delivery stop number to distinguish loading groups visually.
4. THE Diagram_Renderer SHALL annotate each item placement with the Load_Sequence number indicating physical loading order.
5. THE Diagram_Renderer SHALL display summary statistics on the diagram: total weight, volume utilization percentage, and weight per axle.
6. WHEN a Planner requests export, THE Diagram_Renderer SHALL produce output in PDF format suitable for A3 or A4 printing at warehouse scale.
7. WHERE an interactive viewing mode is enabled, THE Diagram_Renderer SHALL provide a 3D rotatable view of the loaded trailer in the web browser.

### Requirement 5: Constraint Handling and Rules Engine

**User Story:** As a Planner, I want to define loading constraints beyond basic dimensions, so that the system respects product-specific handling requirements.

#### Acceptance Criteria

1. THE Load_Diagram_Generator SHALL support Stackability_Rules defined as a matrix of allowed/disallowed product category combinations.
2. WHERE temperature-controlled zones are defined in the Trailer_Profile, THE Packing_Engine SHALL place temperature-sensitive items only within their designated zone.
3. WHEN an item is marked as "floor-only" in the Excel data, THE Packing_Engine SHALL place that item directly on the trailer floor with no items beneath it.
4. WHEN an item is marked as "top-load prohibited," THE Packing_Engine SHALL ensure no other items are placed on top of that item.
5. IF a constraint conflict makes placement infeasible, THEN THE Load_Diagram_Generator SHALL report the specific conflicting constraints and affected items to the Planner.

### Requirement 6: Load Plan Review and Adjustment

**User Story:** As a Planner, I want to review and manually adjust the generated load plan before distributing it, so that I can apply operational knowledge the algorithm may not capture.

#### Acceptance Criteria

1. WHEN a Load_Plan is generated, THE Load_Diagram_Generator SHALL present the plan in an editable view where the Planner can drag items to new positions.
2. WHILE the Planner adjusts item positions, THE Load_Diagram_Generator SHALL validate all constraints in real-time and highlight any violations immediately.
3. WHEN the Planner confirms an adjusted Load_Plan, THE Diagram_Renderer SHALL regenerate the visual diagram reflecting all manual changes.
4. THE Load_Diagram_Generator SHALL maintain an audit trail recording the original computed plan and any manual adjustments made by the Planner.

### Requirement 7: Distribution and Export

**User Story:** As a Planner, I want to distribute the finalized load diagram to the warehouse team easily, so that operators receive clear instructions before loading begins.

#### Acceptance Criteria

1. WHEN a Load_Plan is finalized, THE Load_Diagram_Generator SHALL allow the Planner to export the diagram as a PDF document.
2. WHEN a Load_Plan is finalized, THE Load_Diagram_Generator SHALL allow the Planner to send the diagram via email directly from the application.
3. THE Load_Diagram_Generator SHALL generate a printable loading checklist alongside the diagram listing items in Load_Sequence order with checkboxes for the Warehouse_Operator.
4. WHERE OptiFlow integration is enabled, THE Load_Diagram_Generator SHALL attach the Load_Plan to the corresponding OptiFlow route or transport order.

### Requirement 8: OptiFlow Integration

**User Story:** As a Planner, I want the Load Diagram Generator to integrate with OptiFlow, so that route-optimized delivery sequences automatically inform the loading order.

#### Acceptance Criteria

1. WHERE OptiFlow integration is enabled, THE Load_Diagram_Generator SHALL import delivery stop sequences from OptiFlow route plans to determine Load_Sequence ordering.
2. WHERE OptiFlow integration is enabled, THE Load_Diagram_Generator SHALL export computed Load_Plan weight and volume data back to OptiFlow for transport cost validation.
3. WHEN OptiFlow recalculates a route affecting delivery sequence, THE Load_Diagram_Generator SHALL flag the affected Load_Plan as requiring recomputation.
4. THE Load_Diagram_Generator SHALL authenticate with OptiFlow using API key-based authentication configured by the Planner.

### Requirement 9: Excel Template and Data Format

**User Story:** As a Planner, I want a standardized Excel template for data input, so that I can prepare load data consistently and reduce upload errors.

#### Acceptance Criteria

1. THE Load_Diagram_Generator SHALL provide a downloadable Excel template file with pre-defined column headers and data validation rules.
2. THE Excel_Parser SHALL accept the following columns: Item_ID, Description, Length_mm, Width_mm, Height_mm, Weight_kg, Quantity, Stackability_Class, Max_Stack_Weight_kg, Delivery_Stop, Temperature_Zone, and Floor_Only_Flag.
3. WHEN a Planner downloads the template, THE Load_Diagram_Generator SHALL include an instruction sheet within the Excel workbook explaining each column and valid values.
4. THE Excel_Parser SHALL parse the template, format the data, and produce an equivalent structured data object (round-trip property: export template with data → re-upload → identical Load_Item set).

