# Requirements Document

## Introduction

OptiFlow Flatbed Steel Load Planner is a browser-based application that enables dispatchers, planners, loaders, and drivers to plan, visualize, verify, and export flatbed steel load configurations. The application handles the specialized domain of flatbed steel hauling where placement decisions are driven by deck position, concentrated weight limits, axle distribution, product support requirements, stacking stability, unloading access order, and securement — not generic box-packing or cube utilization. The system performs sophisticated calculations behind the scenes while presenting a simple four-step workflow: Equipment → Steel Orders → Rules → Generate Load Plan.

## Glossary

- **Load_Planner**: The core application system responsible for orchestrating the load planning workflow
- **Planning_Engine**: The deterministic heuristic engine that computes optimal freight placement on the trailer deck
- **Rules_Engine**: The component that manages and enforces loading constraints, preferences, and advisory guidance
- **Drawing_Renderer**: The component that generates 2D visual representations (SVG/Canvas) of load configurations
- **Equipment_Configurator**: The module responsible for managing tractor and trailer specifications
- **Import_Service**: The module responsible for parsing and validating steel order data from external files
- **Weight_Calculator**: The component that computes axle loads, center of gravity, deck concentrated loads, and balance metrics
- **Securement_Planner**: The component that determines chain, strap, binder, blocking, and chock requirements
- **Deck**: The flat cargo surface of a flatbed trailer where freight is placed
- **Dunnage**: Blocking material (wood, rubber, etc.) placed between freight layers or between freight and the deck for support and protection
- **Coil_Rack**: A specialized cradle or saddle device used to secure cylindrical coils in position on the deck
- **Hard_Constraint**: A rule that must never be violated; violations prevent plan approval
- **Soft_Preference**: A rule that should be followed when possible; violations produce warnings but allow plan approval
- **Advisory_Rule**: A suggestion that is noted but does not affect plan validity
- **Stop**: A delivery destination within a multi-stop load where freight must be accessible for unloading
- **Axle_Group**: A set of axles (steer, drive, trailer) whose combined weight must remain within legal limits
- **Center_of_Gravity**: The calculated balance point of the loaded trailer in longitudinal and lateral axes
- **Load_Plan**: The complete output including freight placement coordinates, securement details, warnings, and instructions
- **Planner_Role**: A user who creates and modifies load plans
- **Loader_Role**: A user who executes physical loading based on plan instructions
- **Driver_Role**: A user who reviews and verifies the load before transport
- **Supervisor_Role**: A user who approves load plans and oversees operations
- **Administrator_Role**: A user who manages system configuration, users, equipment, and rules
- **Customer_Viewer_Role**: An external user with read-only access to load plan status

## Requirements

### Requirement 1: Equipment Configuration Management

**User Story:** As a Planner, I want to configure tractor and trailer equipment profiles with all relevant physical specifications, so that the planning engine can accurately calculate placement, weight distribution, and securement requirements.

#### Acceptance Criteria

1. THE Equipment_Configurator SHALL allow creation of trailer profiles with the following attributes: trailer length, deck width, deck height from ground, maximum gross weight, tare weight, number of axles, axle positions (distance from kingpin), axle weight ratings, kingpin position, rear overhang limit, deck material type, stake pocket positions, anchor point positions, and maximum deck concentrated load per square foot
2. THE Equipment_Configurator SHALL support 48-foot and 53-foot standard flatbed trailer configurations as pre-loaded templates
3. THE Equipment_Configurator SHALL allow creation of tractor profiles with the following attributes: steer axle weight rating, drive axle weight rating, fifth-wheel position, tractor tare weight, and number of drive axles
4. WHEN a trailer profile is saved, THE Equipment_Configurator SHALL validate that axle weight ratings sum to at least the maximum gross weight minus tare weight
5. WHEN a user selects a tractor-trailer combination, THE Equipment_Configurator SHALL calculate and display the available payload capacity, total legal gross weight, and per-axle weight limits
6. IF a tractor-trailer combination produces a configuration where available payload is less than zero, THEN THE Equipment_Configurator SHALL display an error and prevent selection for planning

### Requirement 2: Steel Order Data Import

**User Story:** As a Planner, I want to import steel orders from Excel and CSV files or enter them manually, so that I can quickly build a freight manifest for load planning.

#### Acceptance Criteria

1. THE Import_Service SHALL accept CSV and Excel (.xlsx) files containing steel order data
2. WHEN a file is imported, THE Import_Service SHALL parse and validate the following fields for each line item: order number, customer name, delivery stop number, product type, quantity, individual piece weight, individual piece dimensions (length, width, height/diameter), total line weight, handling method (crane/forklift/magnet), stacking permission (yes/no/conditional), maximum stack height, maximum stack weight, orientation requirements, dunnage requirements, and special handling notes
3. WHEN a required field is missing or contains an invalid value, THE Import_Service SHALL identify the specific row and field, display a descriptive error message, and allow the user to correct the value before proceeding
4. THE Import_Service SHALL support manual entry of individual steel order line items with the same field set as file import
5. WHEN an import file contains duplicate order-line combinations, THE Import_Service SHALL flag the duplicates and prompt the user to resolve them
6. THE Import_Service SHALL recognize and categorize the following steel product types: coils (hot-rolled, cold-rolled, galvanized), sheet bundles, plate, rebar bundles, wire rod coils, structural beams (I-beam, H-beam, wide-flange), channels, angles, flat bar, round bar, pipe, tube, hollow structural sections, roofing sheet bundles, wire mesh panels, fabricated steel assemblies, palletized steel, and mixed bundles

### Requirement 3: Geometric Freight Modeling

**User Story:** As a Planner, I want each steel product to be represented by an accurate geometric model, so that the planning engine can calculate placement, stacking, and clearances correctly.

#### Acceptance Criteria

1. THE Planning_Engine SHALL model freight using the following geometric types: rectangular package, long rectangular bundle, cylindrical bundle, horizontal coil (eye horizontal), vertical coil (eye vertical), plate/sheet stack, and irregular freight (bounding box approximation)
2. WHEN a steel product type is imported, THE Planning_Engine SHALL automatically assign the appropriate geometric type based on product category
3. THE Planning_Engine SHALL calculate the contact footprint area for each geometric type to determine deck loading pressure
4. WHEN a cylindrical item is placed horizontally, THE Planning_Engine SHALL calculate the required cradle angle or chock dimensions to prevent rolling
5. THE Planning_Engine SHALL represent each freight item with a position (x, y, z coordinates relative to deck origin at kingpin), orientation (longitudinal or transverse), and rotation state

### Requirement 4: Planning Rules Management

**User Story:** As an Administrator, I want to define and manage loading rules classified by enforcement level, so that the planning engine follows industry standards, legal requirements, and company policies.

#### Acceptance Criteria

1. THE Rules_Engine SHALL classify each rule as one of three types: Hard_Constraint (must never be violated), Soft_Preference (should be followed, violations produce warnings), or Advisory_Rule (noted but does not affect validity)
2. THE Rules_Engine SHALL enforce the following default Hard_Constraints: no axle group exceeds its legal weight rating, total gross vehicle weight does not exceed legal maximum, no single deck area exceeds concentrated load limit, freight at later stops is accessible without moving freight for earlier stops, cylindrical items have adequate anti-roll securement, and no freight extends beyond trailer width or length boundaries
3. THE Rules_Engine SHALL enforce the following default Soft_Preferences: heavier items placed lower in the stack, center of gravity positioned between 40% and 50% of trailer length from the kingpin, left-to-right weight imbalance does not exceed 5% of total freight weight, and dunnage placed between dissimilar metals
4. WHEN a user with Administrator_Role modifies a rule classification, THE Rules_Engine SHALL log the change with timestamp, user identity, previous classification, and new classification
5. THE Rules_Engine SHALL allow Administrators to add custom rules with a name, description, enforcement level, and applicability conditions
6. WHEN a Planner begins load generation, THE Rules_Engine SHALL present a summary of active rules and allow the Planner to acknowledge advisory rules before proceeding

### Requirement 5: Load Plan Generation

**User Story:** As a Planner, I want to click "Generate Load Plan" and receive a complete freight placement solution, so that I can quickly produce a practical loading plan without manual calculations.

#### Acceptance Criteria

1. WHEN the Planner clicks "Generate Load Plan", THE Planning_Engine SHALL produce a complete placement solution within 30 seconds for loads containing up to 50 line items
2. THE Planning_Engine SHALL use a deterministic heuristic approach that produces the same output for the same inputs
3. THE Planning_Engine SHALL place freight following this priority order: (1) respect stop-order accessibility, (2) satisfy all Hard_Constraints, (3) optimize weight distribution across axle groups, (4) apply steel-specific stacking and support rules, (5) satisfy Soft_Preferences, (6) minimize unused deck space
4. THE Planning_Engine SHALL assign each freight item a specific deck position (x, y coordinates), layer (z position), orientation, and support method (direct-to-deck, on-dunnage, on-prior-layer)
5. WHEN the Planning_Engine cannot place all freight items while satisfying all Hard_Constraints on a single trailer, THE Planning_Engine SHALL automatically split the freight into multiple loads and present each load as a separate plan
6. IF the Planning_Engine cannot find any valid placement for one or more items, THEN THE Planning_Engine SHALL identify the unplaceable items, state the constraint that prevented placement, and suggest corrective actions

### Requirement 6: Weight and Balance Calculations

**User Story:** As a Planner, I want real-time weight distribution and balance calculations, so that I can ensure the load is legal and safe before the truck departs.

#### Acceptance Criteria

1. THE Weight_Calculator SHALL compute the following for every load plan: steer axle weight, drive axle weight, trailer axle group weight, total gross vehicle weight, longitudinal center of gravity position (distance from kingpin), lateral center of gravity offset (distance from centerline), and maximum concentrated deck load
2. WHEN any freight item is placed or moved, THE Weight_Calculator SHALL recalculate all weight metrics within 2 seconds
3. THE Weight_Calculator SHALL display weight metrics as both absolute values (pounds/kilograms) and as percentage of each axle group's legal rating
4. IF any axle group weight exceeds 95% of its legal rating, THEN THE Weight_Calculator SHALL display a caution indicator
5. IF any axle group weight exceeds 100% of its legal rating, THEN THE Weight_Calculator SHALL display an overweight violation and prevent plan approval
6. THE Weight_Calculator SHALL calculate deck concentrated load by dividing each item's weight by its contact footprint area and comparing against the trailer's rated capacity per square foot

### Requirement 7: Steel Stacking and Support Rules

**User Story:** As a Planner, I want the system to enforce steel-specific stacking and support rules, so that freight remains stable and undamaged during transport.

#### Acceptance Criteria

1. THE Planning_Engine SHALL enforce that items marked "no stack" are never placed beneath other items
2. THE Planning_Engine SHALL enforce that the total weight of stacked items above any item does not exceed that item's maximum stack weight rating
3. THE Planning_Engine SHALL enforce that the total stack height at any deck position does not exceed the item's maximum stack height or the trailer's legal height limit, whichever is less
4. WHEN coils are placed horizontally, THE Planning_Engine SHALL require coil racks, cradles, or chocking on both sides to prevent rolling
5. WHEN items of dissimilar hardness are stacked, THE Planning_Engine SHALL insert dunnage between layers to prevent surface damage
6. THE Planning_Engine SHALL enforce that long products (beams, bars, pipe) are supported at a minimum of two points with maximum unsupported span not exceeding the product's specified maximum
7. WHEN plate or sheet stacks are placed, THE Planning_Engine SHALL require edge protection and banding to prevent shifting

### Requirement 8: Delivery Stop and Unloading Access

**User Story:** As a Planner, I want to assign customers and delivery stops to freight items and ensure proper unloading access, so that the driver can deliver in sequence without rearranging the load.

#### Acceptance Criteria

1. THE Load_Planner SHALL allow assignment of each freight item to a customer and a numbered delivery stop (1 = first delivery, 2 = second, etc.)
2. THE Planning_Engine SHALL place freight so that items for stop N are accessible (from top, side, or rear as specified by unloading method) without requiring removal of items destined for stops N+1 and beyond
3. THE Load_Planner SHALL support the following unloading methods per stop: overhead crane, forklift from side, forklift from rear, magnet crane, and manual (hand unload)
4. WHEN overhead crane unloading is specified, THE Planning_Engine SHALL ensure the stop's freight has vertical clearance (nothing stacked above that is for a later stop)
5. WHEN side unloading is specified, THE Planning_Engine SHALL ensure the stop's freight is positioned at a trailer edge without later-stop freight blocking lateral access
6. IF the Planning_Engine cannot satisfy unloading access for all stops simultaneously, THEN THE Planning_Engine SHALL report which stops conflict, which items cause the conflict, and suggest reordering or splitting the load

### Requirement 9: Securement Planning

**User Story:** As a Planner, I want the system to calculate securement requirements, so that the load meets DOT/FMCSA tie-down regulations and company safety standards.

#### Acceptance Criteria

1. THE Securement_Planner SHALL calculate the minimum number of tie-downs required for each freight item based on item weight, item length, and applicable FMCSA regulations (minimum one tie-down per 10 feet of article length, minimum two tie-downs per article)
2. THE Securement_Planner SHALL recommend specific securement types for each freight category: chains with binders for coils and heavy plate, straps for bundles and structural shapes, edge protectors where straps contact sharp edges, and blocking/bracing for items requiring positional restraint
3. THE Securement_Planner SHALL calculate the required working load limit for each tie-down based on the aggregate working load limit rule (total WLL of all tie-downs must equal or exceed 50% of cargo weight)
4. WHEN coils are placed, THE Securement_Planner SHALL specify coil-specific securement: direct chain tie-downs through the coil eye, blocking fore and aft, and chocking for horizontal-eye coils
5. THE Securement_Planner SHALL assign each tie-down to a specific anchor point or stake pocket on the trailer deck
6. IF the total number of required tie-downs exceeds available anchor points, THEN THE Securement_Planner SHALL warn the Planner and suggest alternative securement arrangements

### Requirement 10: Load Drawing Generation

**User Story:** As a Planner, I want to view clear 2D drawings of the load plan from multiple perspectives, so that I can visually verify placement and communicate the plan to loaders and drivers.

#### Acceptance Criteria

1. THE Drawing_Renderer SHALL generate the following views for each load plan: top-down view (plan view), left-side elevation view, right-side elevation view, front view (looking from cab toward rear), and rear view (looking from rear toward cab)
2. THE Drawing_Renderer SHALL render each freight item with a distinct visual identifier showing: item outline matching its geometric shape, order/item number label, customer/stop color coding, weight annotation, and dimensions
3. THE Drawing_Renderer SHALL display the trailer outline including deck boundaries, axle positions, kingpin location, stake pockets, and anchor points
4. THE Drawing_Renderer SHALL generate a securement overlay view showing tie-down positions, chain/strap routing, and anchor point assignments
5. THE Drawing_Renderer SHALL generate a dunnage view showing all dunnage material positions, dimensions, and types
6. WHEN the Planner hovers over or selects a freight item in any view, THE Drawing_Renderer SHALL highlight that item across all views simultaneously
7. THE Drawing_Renderer SHALL render all views using scalable vector graphics (SVG) or HTML canvas elements that support zoom, pan, and print at high resolution

### Requirement 11: Manual Load Adjustment

**User Story:** As a Planner, I want to manually reposition, swap, or remove freight items after plan generation, so that I can apply practical knowledge that automated planning cannot capture.

#### Acceptance Criteria

1. THE Load_Planner SHALL allow the Planner to drag freight items to new deck positions in the top-down drawing view
2. THE Load_Planner SHALL allow the Planner to change the orientation (longitudinal/transverse) of any freight item
3. THE Load_Planner SHALL allow the Planner to swap the positions of two freight items
4. THE Load_Planner SHALL allow the Planner to remove a freight item from the current load and return it to the unassigned items list
5. WHEN a manual adjustment is made, THE Weight_Calculator SHALL recalculate all weight and balance metrics within 2 seconds
6. WHEN a manual adjustment is made, THE Rules_Engine SHALL re-evaluate all constraints and display any new violations or warnings immediately
7. IF a manual adjustment causes a Hard_Constraint violation, THEN THE Load_Planner SHALL display a clear warning indicating the specific violation but SHALL allow the Planner to keep the position (override requires Supervisor acknowledgment)

### Requirement 12: Warnings and Notifications

**User Story:** As a Planner, I want plain-language warnings for any rule violations or safety concerns, so that I can make informed decisions without needing to understand engineering formulas.

#### Acceptance Criteria

1. THE Load_Planner SHALL display warnings in plain language without formulas, referencing specific freight items by order number and product description
2. THE Load_Planner SHALL categorize warnings into three severity levels: Error (Hard_Constraint violation, blocks approval), Warning (Soft_Preference violation, allows approval with acknowledgment), and Info (Advisory_Rule note)
3. WHEN a warning is generated, THE Load_Planner SHALL state: what is wrong, which items are affected, what the limit or threshold is, and what corrective action is recommended
4. THE Load_Planner SHALL display a warning summary panel showing total counts by severity level and a scrollable list of all active warnings
5. WHEN all Hard_Constraint violations are resolved, THE Load_Planner SHALL enable the "Approve Plan" action

### Requirement 13: Loading and Unloading Instructions

**User Story:** As a Loader, I want step-by-step loading instructions in sequence, so that I can execute the plan without interpreting complex diagrams.

#### Acceptance Criteria

1. THE Load_Planner SHALL generate a numbered loading sequence listing each item in the order it must be placed on the trailer (first item placed = step 1)
2. WHEN generating loading instructions, THE Load_Planner SHALL include for each step: step number, item description, placement position in plain language (e.g., "Place at front-left of deck, 4 feet from headboard"), orientation, dunnage to place first, and securement to apply after placement
3. THE Load_Planner SHALL generate unloading instructions per delivery stop listing items in removal order
4. THE Load_Planner SHALL include securement removal steps in unloading instructions (e.g., "Remove chains 3 and 4 before lifting coil")
5. THE Load_Planner SHALL format instructions for two audiences: warehouse-view (for loaders with crane/forklift context) and driver-view (for drivers performing pre-trip verification)

### Requirement 14: Plan Approval and Versioning

**User Story:** As a Supervisor, I want to review, approve, or reject load plans with version history, so that there is an auditable record of planning decisions.

#### Acceptance Criteria

1. THE Load_Planner SHALL maintain a version history for each load plan, incrementing the version number on every save
2. WHEN a Planner submits a plan for approval, THE Load_Planner SHALL set the plan status to "Pending Approval" and notify the assigned Supervisor
3. THE Load_Planner SHALL allow the Supervisor to approve, reject (with reason), or return the plan for revision
4. WHEN a plan is approved, THE Load_Planner SHALL lock the plan against further edits unless a new version is explicitly created
5. THE Load_Planner SHALL retain all previous versions and allow comparison between any two versions
6. WHEN a plan is modified after approval, THE Load_Planner SHALL create a new version and require re-approval

### Requirement 15: Export and Output

**User Story:** As a Planner, I want to export the final load plan as PDF and Excel files, so that I can distribute loading sheets to warehouse staff and drivers who may not have application access.

#### Acceptance Criteria

1. THE Load_Planner SHALL export load plans as multi-page PDF documents containing: cover page with summary, all drawing views, loading sequence instructions, securement details, weight summary, warning summary, and driver verification checklist
2. THE Load_Planner SHALL export load plans as Excel workbooks with separate sheets for: freight manifest, placement coordinates, weight calculations, securement requirements, and loading sequence
3. THE Load_Planner SHALL generate a printable single-page loading summary suitable for attachment to a clipboard or truck cab
4. THE Load_Planner SHALL provide shareable links with role-appropriate views: full plan for Planners and Supervisors, loading instructions for Loaders, and verification checklist for Drivers
5. WHEN a Customer_Viewer accesses a shared link, THE Load_Planner SHALL display only the items assigned to that customer's stops with delivery status

### Requirement 16: Multi-Load Splitting

**User Story:** As a Planner, I want the system to automatically split orders across multiple trailers when freight exceeds single-trailer capacity, so that I receive a complete shipping plan for all freight.

#### Acceptance Criteria

1. WHEN total freight weight exceeds available payload capacity, THE Planning_Engine SHALL split freight into multiple load plans
2. WHEN total freight volume exceeds available deck space, THE Planning_Engine SHALL split freight into multiple load plans
3. THE Planning_Engine SHALL keep all items for a single delivery stop on the same trailer unless physically impossible
4. THE Planning_Engine SHALL present multi-load results as a set of linked plans with a master summary showing which items are assigned to which trailer
5. THE Load_Planner SHALL allow the Planner to manually reassign items between trailers in a multi-load set
6. WHEN items are reassigned between trailers, THE Weight_Calculator SHALL recalculate metrics for all affected trailers

### Requirement 17: User Authentication and Role-Based Access

**User Story:** As an Administrator, I want role-based access control, so that each user sees only the functionality appropriate to their role.

#### Acceptance Criteria

1. THE Load_Planner SHALL authenticate users before granting access to any application functionality
2. THE Load_Planner SHALL enforce the following role permissions: Planner_Role (create, edit, submit plans), Loader_Role (view loading instructions, mark steps complete), Driver_Role (view plans, complete verification checklist), Supervisor_Role (approve/reject plans, override warnings), Administrator_Role (manage users, equipment, rules, system configuration), Customer_Viewer_Role (view assigned delivery items, read-only)
3. WHEN a user attempts an action outside their role permissions, THE Load_Planner SHALL deny the action and display a message indicating insufficient permissions
4. THE Load_Planner SHALL allow a single user to hold multiple roles simultaneously
5. THE Administrator_Role SHALL be the only role permitted to modify equipment templates, planning rules, and user role assignments

### Requirement 18: Driver and Loader Verification

**User Story:** As a Driver, I want a digital verification checklist, so that I can confirm the load matches the plan before departing.

#### Acceptance Criteria

1. THE Load_Planner SHALL generate a verification checklist for each approved load plan containing: item presence check (each item on trailer matches plan), securement check (each tie-down in place and tensioned), weight check (scale weights within tolerance of calculated values), and damage check (no visible freight damage)
2. WHEN the Driver marks all checklist items as verified, THE Load_Planner SHALL record the verification timestamp and Driver identity
3. IF a Driver marks a checklist item as non-conforming, THEN THE Load_Planner SHALL require the Driver to enter a description of the discrepancy and notify the Supervisor
4. THE Load_Planner SHALL allow Loaders to mark loading steps as complete in sequence, providing a real-time progress indicator

### Requirement 19: Steel Load Pattern Templates

**User Story:** As a Planner, I want the planning engine to apply recognized steel-loading patterns, so that the generated plans reflect real-world best practices for flatbed steel hauling.

#### Acceptance Criteria

1. THE Planning_Engine SHALL recognize and apply the following load pattern templates: layered (uniform items stacked in flat layers), column building (items stacked vertically in columns from deck), row building (items placed side-by-side across deck width), long-product (beams/bars/pipe placed longitudinally with overhang management), nested (items nested for stability such as channels stacked or angles interlocked), customer zoning (deck divided into zones by delivery stop), and mixed (combination of patterns for heterogeneous freight)
2. WHEN freight composition matches a known pattern, THE Planning_Engine SHALL apply that pattern as the starting placement strategy
3. THE Planning_Engine SHALL allow the Planner to override the selected pattern and specify an alternative before generation
4. THE Planning_Engine SHALL apply customer zoning as an overlay pattern, dividing the deck into longitudinal zones ordered by delivery stop sequence (first-off nearest rear)

### Requirement 20: Application Performance and Responsiveness

**User Story:** As a Planner, I want the application to respond quickly to interactions, so that I can work efficiently without waiting for calculations or screen updates.

#### Acceptance Criteria

1. THE Load_Planner SHALL render drawing views within 3 seconds after plan generation completes
2. THE Load_Planner SHALL update drawing views within 1 second after a manual adjustment
3. THE Load_Planner SHALL support concurrent use by a minimum of 20 simultaneous planners without degradation below stated performance thresholds
4. THE Drawing_Renderer SHALL render drawings that remain readable and interactive on screen widths from 1024 pixels to 3840 pixels
5. THE Load_Planner SHALL function on current versions of Chrome, Firefox, Edge, and Safari browsers
6. WHEN a network interruption occurs during plan editing, THE Load_Planner SHALL preserve unsaved changes locally and synchronize when connectivity resumes
