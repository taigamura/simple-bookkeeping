import ExpoModulesCore
import Foundation
import MultipeerConnectivity

public final class KajiNearbyModule: Module {
  private var controller: NearbyController?

  public func definition() -> ModuleDefinition {
    Name("KajiNearby")

    Events("onPeer", "onMessage", "onError")

    AsyncFunction("startAsync") { (serviceType: String, deviceId: String, protocolVersion: Int, householdTag: String) in
      guard serviceType.count >= 1 && serviceType.count <= 15 else {
        throw NearbyException("Invalid MultipeerConnectivity service type")
      }
      guard !deviceId.isEmpty && !householdTag.isEmpty else {
        throw NearbyException("Missing nearby identity")
      }
      self.controller?.stop()
      let controller = NearbyController(
        serviceType: serviceType,
        deviceId: deviceId,
        protocolVersion: protocolVersion,
        householdId: householdTag,
        emit: { [weak self] name, body in self?.sendEvent(name, body) }
      )
      self.controller = controller
      controller.start()
    }.runOnQueue(.main)

    AsyncFunction("stopAsync") {
      self.controller?.stop()
      self.controller = nil
    }.runOnQueue(.main)

    AsyncFunction("sendAsync") { (peerDeviceId: String, envelope: String) in
      try self.controller?.send(peerDeviceId: peerDeviceId, envelope: envelope)
    }.runOnQueue(.main)
  }
}

private struct NearbyException: Exception {
  let reason: String
  init(_ reason: String) { self.reason = reason }
}

private final class NearbyController: NSObject {
  private let serviceType: String
  private let protocolVersion: Int
  private let householdId: String
  private let peerId: MCPeerID
  private let session: MCSession
  private let advertiser: MCNearbyServiceAdvertiser
  private let browser: MCNearbyServiceBrowser
  private let emit: (String, [String: Any]) -> Void
  private var discoveryByPeer: [MCPeerID: [String: String]] = [:]

  init(
    serviceType: String,
    deviceId: String,
    protocolVersion: Int,
    householdId: String,
    emit: @escaping (String, [String: Any]) -> Void
  ) {
    self.serviceType = serviceType
    self.protocolVersion = protocolVersion
    self.householdId = householdId
    self.peerId = MCPeerID(displayName: deviceId)
    self.session = MCSession(peer: self.peerId, securityIdentity: nil, encryptionPreference: .required)
    self.advertiser = MCNearbyServiceAdvertiser(
      peer: self.peerId,
      discoveryInfo: ["v": String(protocolVersion), "h": householdId],
      serviceType: serviceType
    )
    self.browser = MCNearbyServiceBrowser(peer: self.peerId, serviceType: serviceType)
    self.emit = emit
    super.init()
    self.session.delegate = self
    self.advertiser.delegate = self
    self.browser.delegate = self
  }

  func start() {
    advertiser.startAdvertisingPeer()
    browser.startBrowsingForPeers()
  }

  func stop() {
    browser.stopBrowsingForPeers()
    advertiser.stopAdvertisingPeer()
    session.disconnect()
    discoveryByPeer.removeAll()
  }

  func send(peerDeviceId: String, envelope: String) throws {
    guard let peer = session.connectedPeers.first(where: { $0.displayName == peerDeviceId }) else {
      throw NearbyException("Nearby peer is not connected")
    }
    guard let data = envelope.data(using: .utf8), data.count <= 1_100_000 else {
      throw NearbyException("Nearby envelope is invalid or too large")
    }
    try session.send(data, toPeers: [peer], with: .reliable)
  }

  private func emitError(_ error: Error) {
    DispatchQueue.main.async { self.emit("onError", ["message": error.localizedDescription]) }
  }

  private func invitationContext() -> Data? {
    try? JSONSerialization.data(withJSONObject: ["v": protocolVersion, "h": householdId])
  }

  private func validContext(_ data: Data?) -> Bool {
    guard let data,
          let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          value["v"] as? Int == protocolVersion,
          value["h"] as? String == householdId else { return false }
    return true
  }
}

extension NearbyController: MCNearbyServiceBrowserDelegate {
  func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
    guard peerID != peerId,
          info?["v"] == String(protocolVersion),
          info?["h"] == householdId else { return }
    discoveryByPeer[peerID] = info
    browser.invitePeer(peerID, to: session, withContext: invitationContext(), timeout: 20)
  }

  func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
    discoveryByPeer.removeValue(forKey: peerID)
  }

  func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
    emitError(error)
  }
}

extension NearbyController: MCNearbyServiceAdvertiserDelegate {
  func advertiser(
    _ advertiser: MCNearbyServiceAdvertiser,
    didReceiveInvitationFromPeer peerID: MCPeerID,
    withContext context: Data?,
    invitationHandler: @escaping (Bool, MCSession?) -> Void
  ) {
    guard peerID != peerId, validContext(context) else {
      invitationHandler(false, nil)
      return
    }
    discoveryByPeer[peerID] = ["v": String(protocolVersion), "h": householdId]
    invitationHandler(true, session)
  }

  func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
    emitError(error)
  }
}

extension NearbyController: MCSessionDelegate {
  func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
    guard state == .connected else { return }
    DispatchQueue.main.async {
      self.emit("onPeer", [
        "deviceId": peerID.displayName,
        "protocolVersion": self.protocolVersion,
        "householdTag": self.householdId
      ])
    }
  }

  func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
    guard data.count <= 1_100_000, let envelope = String(data: data, encoding: .utf8) else { return }
    DispatchQueue.main.async {
      self.emit("onMessage", [
        "deviceId": peerID.displayName,
        "protocolVersion": self.protocolVersion,
        "householdTag": self.householdId,
        "envelope": envelope
      ])
    }
  }

  func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}
  func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}
  func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {
    if let error { emitError(error) }
  }
}
