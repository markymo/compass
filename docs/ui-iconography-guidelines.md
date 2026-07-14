# UI Iconography Guidelines

To ensure consistency across the platform (including the home page and PDF exports), the following semantic icons from `lucide-react` should be used to represent entity types:

- **Client (Corporate, Partnership, Trust):** `Building2` (represents a corporate building/factory, matching the Home Page).
- **Client Legal Entity (LE):** `Landmark` (represents an official, registered entity).
- **Supplier (Bank / FI / Service Provider):** `Landmark` (represents a financial institution, matching the Home Page).

## Usage in PDF Exports
When rendering the identity card in the PDF export, follow the home page's design language:
- Client: uses `Building2` (BuildingIcon)
- Client Legal Entity: uses `Landmark` (LandmarkIcon)
- Supplier: uses `Landmark` (LandmarkIcon)
