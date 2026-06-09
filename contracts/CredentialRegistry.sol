// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CredentialRegistry
 * @notice Tamper-evident registry for academic credentials (diplomas / transcripts).
 *
 * Design intent
 * -------------
 * The blockchain stores ONLY a cryptographic anchor for each credential: the
 * keccak256 hash of an off-chain JSON record, plus minimal metadata needed to
 * prove authenticity, ownership, and current status. No personal data
 * (names, grades, dates of birth) is ever written on-chain.
 *
 * Roles
 * -----
 *  - Admin (contract deployer / registrar): authorizes and removes Issuers.
 *  - Issuer (university / college): issues and revokes credentials.
 *  - Holder (student): owns a credential; grants/revokes Verifier access.
 *  - Verifier (employer / another institution): checks authenticity, ownership,
 *    and status; may be granted access to view the off-chain metadata pointer.
 *
 * What blockchain buys us here
 * ----------------------------
 *  - Tamper evidence: the on-chain hash cannot be silently altered.
 *  - Issuer authenticity: only an admin-authorized issuer can mint a credential.
 *  - Decentralized verification: a verifier checks status without phoning the
 *    university, and the university cannot quietly "lose" an inconvenient record.
 *  - Revocation that is publicly auditable via events.
 */
contract CredentialRegistry {
    /* ----------------------------- Types ------------------------------ */

    enum Status {
        None, // 0: never issued (default)
        Active, // 1: valid
        Revoked // 2: revoked by the issuer
    }

    struct Credential {
        address issuer; // who issued it (must be an authorized issuer)
        address holder; // the student who owns it
        uint64 issuedAt; // block timestamp at issuance
        uint64 updatedAt; // block timestamp of last status change
        Status status; // Active / Revoked
        string metadataURI; // off-chain pointer (e.g. ipfs://CID) to the JSON record
    }

    /* ----------------------------- Storage ---------------------------- */

    address public admin;

    // issuer address => human-readable institution name (non-empty = authorized)
    mapping(address => string) public issuerName;
    mapping(address => bool) public isIssuer;

    // credentialId (keccak256 of off-chain JSON) => Credential
    mapping(bytes32 => Credential) private credentials;

    // credentialId => verifier => allowed to view metadata pointer
    mapping(bytes32 => mapping(address => bool)) private accessGranted;

    /* ------------------------------ Events ---------------------------- */

    event IssuerAdded(address indexed issuer, string name);
    event IssuerRemoved(address indexed issuer);
    event CredentialIssued(
        bytes32 indexed id,
        address indexed issuer,
        address indexed holder,
        uint64 issuedAt
    );
    event CredentialRevoked(bytes32 indexed id, address indexed issuer, uint64 revokedAt);
    event AccessGranted(bytes32 indexed id, address indexed holder, address indexed verifier);
    event AccessRevoked(bytes32 indexed id, address indexed holder, address indexed verifier);

    /* ---------------------------- Modifiers --------------------------- */

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyIssuer() {
        require(isIssuer[msg.sender], "Not authorized issuer");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /* ----------------------- Issuer management ------------------------ */
    /*This responds to the Issuer Management section under Smart Contract Implementation. Admin-gated issuer registry management*/ 

    function addIssuer(address issuer, string calldata name) external onlyAdmin {
        require(issuer != address(0), "Zero address");
        require(bytes(name).length > 0, "Name required");
        require(!isIssuer[issuer], "Already an issuer");
        isIssuer[issuer] = true;
        issuerName[issuer] = name;
        emit IssuerAdded(issuer, name);
    }

    function removeIssuer(address issuer) external onlyAdmin {
        require(isIssuer[issuer], "Not an issuer");
        isIssuer[issuer] = false;
        delete issuerName[issuer];
        emit IssuerRemoved(issuer);
    }

    /* ------------------------- Core lifecycle ------------------------- */

    /**
     * @notice Issue a credential. `id` is the keccak256 hash of the off-chain
     *         JSON record, computed by the issuer before calling.
     */
     /*This responds to the Credential lifecycle section under Smart Contract Implementation. Issue and revoke, with the no-overwrite and issuing-issuer guards*/ 

    function issueCredential(
        bytes32 id,
        address holder,
        string calldata metadataURI
    ) external onlyIssuer {
        require(id != bytes32(0), "Empty id");
        require(holder != address(0), "Zero holder");
        require(credentials[id].status == Status.None, "Already issued");

        credentials[id] = Credential({
            issuer: msg.sender,
            holder: holder,
            issuedAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            status: Status.Active,
            metadataURI: metadataURI
        });

        emit CredentialIssued(id, msg.sender, holder, uint64(block.timestamp));
    }

    /**
     * @notice Revoke a credential. Only the issuing issuer may revoke, and only
     *         while they remain an authorized issuer.
     */
    function revokeCredential(bytes32 id) external onlyIssuer {
        Credential storage c = credentials[id];
        require(c.status == Status.Active, "Not active");
        require(c.issuer == msg.sender, "Not issuing issuer");
        c.status = Status.Revoked;
        c.updatedAt = uint64(block.timestamp);
        emit CredentialRevoked(id, msg.sender, uint64(block.timestamp));
    }

    /* --------------------- Holder access control ---------------------- */
    /*This responds to the Holder-controlled access under Smart Contract Implementation. Holder-gated disclosure of the off-chain pointer.*/ 
    function grantAccess(bytes32 id, address verifier) external {
        require(credentials[id].holder == msg.sender, "Not credential holder");
        require(verifier != address(0), "Zero verifier");
        accessGranted[id][verifier] = true;
        emit AccessGranted(id, msg.sender, verifier);
    }

    function revokeAccess(bytes32 id, address verifier) external {
        require(credentials[id].holder == msg.sender, "Not credential holder");
        accessGranted[id][verifier] = false;
        emit AccessRevoked(id, msg.sender, verifier);
    }

    /* ----------------------------- Views ------------------------------ */

    /**
     * @notice Public authenticity check. Anyone can confirm a credential exists,
     *         who issued it, who holds it, and whether it is currently valid.
     *         Does NOT return the metadata pointer (that is access-gated below).
     */
     /*This responds to the verification views and events under Smart Contract Implementation. Permissionless verification views; all six state-changing events are declared at the top of the contract.*/ 
    function verifyCredential(bytes32 id)
        external
        view
        returns (
            bool exists,
            address issuer,
            address holder,
            Status status,
            uint64 issuedAt,
            uint64 updatedAt
        )
    {
        Credential storage c = credentials[id];
        exists = c.status != Status.None;
        return (exists, c.issuer, c.holder, c.status, c.issuedAt, c.updatedAt);
    }

    /**
     * @notice Access-gated read of the off-chain metadata pointer. Callable by
     *         the holder, the issuer, or a verifier the holder granted access.
     */
    function getMetadataURI(bytes32 id) external view returns (string memory) {
        Credential storage c = credentials[id];
        require(c.status != Status.None, "No such credential");
        require(
            msg.sender == c.holder ||
                msg.sender == c.issuer ||
                accessGranted[id][msg.sender],
            "Access denied"
        );
        return c.metadataURI;
    }

    function hasAccess(bytes32 id, address verifier) external view returns (bool) {
        return accessGranted[id][verifier];
    }

    function isValid(bytes32 id) external view returns (bool) {
        return credentials[id].status == Status.Active;
    }
}
