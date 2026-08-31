# Requirements Document

## Introduction

The Daily Fleet Load Planner evolves the existing single-truck flatbed load planning tool into a multi-vehicle fleet planning system. Instead of manually selecting one truck and generating one plan, the user uploads a daily fleet manifest (specifying available vehicles) alongside the orders file (with delivery numbers that map orders to vehicles). The system then generates an independent load plan for each vehicle-to-orders assignment in one batch operation, producing N plans from a single workflow execution.

## Glossary

- **Fleet_File**: A spreadsheet file (CSV or XLSX) uploaded by the user that defines the set of vehicles available for a given planning day. Each row represents one vehicle.
- **Orders_File**: A spreadsheet file (CSV or XLSX) uploaded by the user containing steel order line items. Each order row includes a Delivery_Number that links the order to a specific vehicle.
- **Delivery_Number**: A code present in each order row that identifies which vehicle the order is assigned to for that day's dispatching.
- **Vehicle_Record**: A single row in the Fleet_File representing one vehicle. Contains: vehicle ID, vehicle type, license plate, weight capacity, platform length, platform width, and condition code.
- **Condition_Code**: A classification code (ZN, ZO, ZB, ZA, ZF) that categorizes a vehicle by weight class and zone. Used to resolve the vehicle's equipment profile from the regional presets catalog.
- **Fleet_Planner**: The system module responsible for orchestrating the multi-vehicle planning workflow: parsing the fleet file, matching orders to vehicles, and invoking the planning engine per vehicle.
- **Planning_Engine**: The existing deterministic load placement algorithm that generates a load plan for a single trailer given a set of freight items and equipment profile.
- **Fleet_Plan_Result**: The aggregate output of the Fleet_Planner containing one PlanResult per vehicle along with summary statistics and any unmatched orders.
- **Vehicle_Profile**: The resolved TrailerProfile and TractorProfile combination derived from a Vehicle_Record using the condition code and vehicle type to look up the appropriate regional preset.

## Requirements

### Requirement 1: Fleet File Upload and Parsing

**User Story:** As a load planner, I want to upload a fleet file that describes today's available vehicles, so that the system knows which trucks are available and their capacities.

#### Acceptance Criteria

1. WHEN a user uploads a Fleet_File in CSV or XLSX format, THE Fleet_Planner SHALL parse the file and produce an array of Vehicle_Record objects.
2. THE Fleet_Planner SHALL require the following fields in each Vehicle_Record: vehicle ID, vehicle type, license plate, weight capacity (tonnes), platform length (metres), platform width (metres), and condition code.
3. WHEN a Fleet_File row is missing a required field or contains an invalid value, THE Fleet_Planner SHALL report a per-row validation error that includes the row number, field name, and a descriptive message.
4. WHEN the Fleet_File contains duplicate vehicle IDs, THE Fleet_Planner SHALL report a duplicate error listing all affected rows.
5. WHEN a Fleet_File contains zero valid Vehicle_Record rows after validation, THE Fleet_Planner SHALL prevent the user from proceeding to the next step and display a summary of errors.

### Requirement 2: Vehicle Profile Resolution

**User Story:** As a load planner, I want each uploaded vehicle to be automatically matched to its equipment profile, so that the planning engine uses the correct dimensions and weight limits.

#### Acceptance Criteria

1. WHEN a valid Vehicle_Record is parsed, THE Fleet_Planner SHALL resolve a Vehicle_Profile by matching the vehicle type and condition code to the corresponding regional preset (Peru catalog).
2. IF a Vehicle_Record has a condition code or vehicle type that does not match any regional preset, THEN THE Fleet_Planner SHALL flag the vehicle as unresolvable with a descriptive error message and exclude the vehicle from plan generation.
3. THE Fleet_Planner SHALL override the preset's weight capacity with the specific weight capacity value from the Fleet_File when the Fleet_File value differs from the preset default.
4. THE Fleet_Planner SHALL override the preset's platform length and width with the specific values from the Fleet_File when the Fleet_File values differ from the preset defaults.

### Requirement 3: Orders File with Delivery Number Mapping

**User Story:** As a load planner, I want to upload an orders file where each order is linked to a truck via delivery number, so that the system knows which orders go on which vehicle.

#### Acceptance Criteria

1. WHEN a user uploads an Orders_File, THE Fleet_Planner SHALL parse and validate the file using the existing steel order import pipeline (smartMapper + validation).
2. THE Fleet_Planner SHALL require each order row to contain a Delivery_Number field.
3. WHEN an order row is missing a Delivery_Number, THE Fleet_Planner SHALL report a validation error for that row.
4. THE Fleet_Planner SHALL group validated orders by Delivery_Number, producing one order set per vehicle assignment.
5. WHEN a Delivery_Number in the Orders_File does not match any vehicle ID in the Fleet_File, THE Fleet_Planner SHALL flag those orders as unmatched and present them to the user in an unmatched-orders summary.

### Requirement 4: Batch Plan Generation

**User Story:** As a load planner, I want the system to generate one load plan per vehicle with its assigned orders, so that I get a complete set of daily plans in a single operation.

#### Acceptance Criteria

1. WHEN the user triggers plan generation, THE Fleet_Planner SHALL invoke the Planning_Engine once per vehicle that has at least one matched order, passing the resolved Vehicle_Profile and the vehicle's assigned order set.
2. THE Fleet_Planner SHALL produce a Fleet_Plan_Result containing one PlanResult per vehicle, preserving the vehicle ID, license plate, and vehicle type alongside each plan.
3. WHILE generating plans for multiple vehicles, THE Fleet_Planner SHALL process each vehicle independently so that a failure on one vehicle does not prevent plan generation for other vehicles.
4. IF the Planning_Engine fails to produce a valid plan for a given vehicle, THEN THE Fleet_Planner SHALL include that vehicle in the Fleet_Plan_Result with a failure status and the list of unplaced items.
5. THE Fleet_Planner SHALL report the total number of vehicles planned, the number of successful plans, and the number of failed plans in a fleet summary.

### Requirement 5: Fleet Plan Review Interface

**User Story:** As a load planner, I want to review each vehicle's load plan individually within the same session, so that I can inspect and approve plans per truck.

#### Acceptance Criteria

1. WHEN a Fleet_Plan_Result is generated, THE Fleet_Planner SHALL display a fleet summary dashboard showing all vehicles with their plan status (success, partial, or failed).
2. WHEN the user selects a vehicle from the fleet summary, THE Fleet_Planner SHALL display that vehicle's detailed load plan using the existing plan visualization (drawing renderer, item list, weight metrics).
3. THE Fleet_Planner SHALL allow the user to navigate between vehicle plans without re-running the planning engine.
4. THE Fleet_Planner SHALL display the vehicle license plate, vehicle type, and condition code in the header of each individual plan view.

### Requirement 6: Modified Wizard Flow for Fleet Mode

**User Story:** As a load planner, I want a streamlined wizard flow for fleet planning that replaces the single-truck equipment step with a fleet upload step, so that the workflow matches the daily fleet planning use case.

#### Acceptance Criteria

1. THE Fleet_Planner SHALL provide a fleet planning mode that modifies the wizard flow to: Step 1 — Upload Fleet_File, Step 2 — Upload Orders_File, Step 3 — Review rules, Step 4 — Generate and review fleet plans.
2. WHEN the user enters fleet planning mode, THE Fleet_Planner SHALL skip the single-equipment selection step and use the fleet file to determine equipment for each vehicle.
3. THE Fleet_Planner SHALL retain the existing single-truck wizard flow as an alternative mode so that users can still plan for one truck manually.
4. THE Fleet_Planner SHALL display a mode selector at the wizard entry point that allows the user to choose between single-truck mode and fleet mode.

### Requirement 7: Fleet File Field Mapping

**User Story:** As a load planner, I want the system to intelligently map fleet file columns to the expected fields, so that I can use fleet files with varying column naming conventions.

#### Acceptance Criteria

1. WHEN a Fleet_File is uploaded, THE Fleet_Planner SHALL apply column-name matching logic (similar to the existing smartMapper) to map source columns to required Vehicle_Record fields.
2. WHEN the Fleet_Planner cannot auto-map one or more required fields, THE Fleet_Planner SHALL present a manual field mapping interface allowing the user to assign columns to fields.
3. WHEN the user confirms or corrects the field mapping, THE Fleet_Planner SHALL re-parse the Fleet_File using the confirmed mapping and report any validation errors.

### Requirement 8: Delivery Number to Vehicle ID Matching Strategy

**User Story:** As a load planner, I want flexible matching between delivery numbers and vehicle IDs, so that the system can handle different encoding schemes used by the dispatch system.

#### Acceptance Criteria

1. THE Fleet_Planner SHALL first attempt exact-match between Delivery_Number and vehicle ID.
2. IF exact-match fails for a Delivery_Number, THEN THE Fleet_Planner SHALL attempt substring or pattern matching where the vehicle ID appears as a component within the Delivery_Number.
3. WHEN neither exact nor pattern matching produces a unique vehicle match, THE Fleet_Planner SHALL present the unmatched orders to the user with a manual assignment interface.
4. THE Fleet_Planner SHALL allow the user to define a custom extraction rule (e.g., character positions or delimiter splitting) to decode vehicle IDs from Delivery_Numbers.

