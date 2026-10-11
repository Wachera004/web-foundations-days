# SnapShare System Scaling Plan

## 1. Assumptions & Active Users
* **Total Registered Users:** 10,000,000
* **Daily Active User (DAU) Rate:** 10%
* **Daily Active Users:** 1,000,000 users per day
* **Upload Activity:** 1 photo per active user daily
* **Consumption Activity:** 50 feed page views per active user daily
* **File Sizes:** Original photo = 2 MB; Thumbnail = 50 KB (0.05 MB)

## 2. Capacity & Traffic Estimates
* **Uploads per Second (Writes):** 
  * Average: $1,000,000 / 86,400 \approx$ **11.57 uploads/sec**
  * Peak (5×): **~58 uploads/sec**
* **Feed Views per Second (Reads):** 
  * Average: $(1,000,000 \times 50) / 86,400 \approx$ **578.7 reads/sec**
  * Peak (5×): **~2,894 reads/sec**
* **Annual Storage Requirement:** 
  * Total photos/year = $1,000,000 \times 365 = 365,000,000$ photos
  * Storage per photo = $2 \text{ MB} + 0.05 \text{ MB} = 2.05 \text{ MB}$
  * Total storage = $365,000,000 \times 2.05 \text{ MB} = 748,250,000 \text{ MB} \approx$ **748.25 TB per year** (decimal units; excludes replicas, backups, and metadata)

These averages assume activity is spread evenly across 86,400 seconds per day, a 365-day year, and decimal storage units (1 TB = 1,000,000 MB); peak traffic is estimated at five times the average.

## 3. Read-Heavy vs. Write-Heavy Nature
* SnapShare is heavily **read-heavy** (50 feed page views for every photo upload). 
* **Design Implication:** The architecture must emphasize caching layers, read replicas for the database, and content delivery networks (CDNs) to serve media assets rapidly without bottlenecking core servers.

## 4. Storage Strategy for Photos
* Photos are not stored inside the relational database because binary large objects (BLOBs) cause database bloat, slow down indexing and backups, and increase operational costs. 
* Instead, binary photo files are stored in scalable **Object Storage** (e.g., AWS S3), while lightweight metadata (image URLs, user IDs, timestamps) is stored in the relational database.

## 5. Architecture Diagram
```text
[ Clients ] -- photo requests --> [ CDN ] -- cache miss --> [ Object Storage ]
     |
     +-- feed/API requests and uploads --> [ Load Balancer ] --> [ App Servers ]
                                                                     |
                                   +---------------------------------+-------------------+
                                   |                 |               |                   |
                                   v                 v               v                   v
                              [ Cache ]    [ Primary Database ]  [ Object Storage ]  [ Queue ]
                                                  | writes                            |
                                                  | replication                       v
                                                  v                            [ Thumbnail Worker ]
                                           [ Read Replica ]                          |       |
                                             feed reads                              |       +--> update metadata
                                                                                     +----------> Object Storage
```

## 6. What Each Component Solves
* **CDN:** Serves cached photos and thumbnails from locations near viewers, reducing image latency and origin traffic.
* **Load balancer:** Distributes incoming API traffic across healthy app servers so one server does not become a bottleneck.
* **App servers:** Authenticate users and handle upload requests, feed generation, and coordination with storage and databases.
* **Cache:** Keeps frequently requested feed data and other hot results in fast memory to reduce repeated database reads.
* **Primary database:** Stores durable photo metadata and handles writes such as new photo records.
* **Read replica:** Serves database read queries separately from the primary to scale feed and metadata reads.
* **Object storage:** Holds original photos and generated thumbnails as durable, scalable files outside the relational database.
* **Queue:** Buffers thumbnail jobs so image processing can happen asynchronously without making uploads wait for it.
* **Thumbnail worker:** Pulls jobs from the queue, creates resized images, stores them, and records their location in the database.

## 7. Photo Upload Flow
1. The client sends an upload request and photo to the app through the load balancer.
2. An app server authenticates the user, validates the request, and writes the original photo to object storage.
3. The app server saves the photo's metadata and original-file location in the primary database.
4. After the original and metadata are saved, the app server enqueues a thumbnail-generation job with the photo identifier and storage location.
5. A thumbnail worker takes the job, reads the original from object storage, creates the thumbnail, and writes it back to object storage.
6. The worker updates the photo metadata with the thumbnail location; the CDN can then cache and serve the original and thumbnail to viewers.

## 8. Trade-Offs
* **Caching versus freshness:** A cache and CDN reduce database load and image latency, but a newly uploaded photo or changed feed may not appear everywhere immediately until cached data expires or is invalidated.
* **Asynchronous thumbnails versus immediate availability:** Queueing thumbnail work makes uploads faster and isolates image processing from API traffic, but the thumbnail is unavailable until a worker finishes; the product must show a placeholder or the original in the meantime.
* **Object storage versus database simplicity:** Object storage scales more economically for large files and keeps the database focused on metadata, but the application must coordinate file storage and database records and handle failures between those operations.