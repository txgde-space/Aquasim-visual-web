/**
 * VBF source package, GPL-2.0-only; original copyright notices retained below.
 * Upstream: https://github.com/spinachAn/aqua-sim-dev
 * Revision: fa7a655f7fbf2c1c2e5a9f1329893d759f1d2f0f
 * Files: src/aqua-sim-tg/model/aqua-sim-routing-vbf.{h,cc}
 * Port details and validation: docs/protocols/vbf.md
 */
export const VECTOR_BASED_FORWARDING_CC = String.raw`
// Private header retains the upstream byte layout, with signed millimeter coordinates
// and initialized fields. It does not change the installed legacy VBHeader globally.
#include "ns3/aqua-sim-tg-module.h"
#include "ns3/header.h"
#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>
namespace ns3 {
class AquaVisualVbfHeader : public VBHeader {
public:
    AquaVisualVbfHeader() {
        SetMessType(0); SetPkNum(0); SetTargetAddr(AquaSimAddress(0));
        SetSenderAddr(AquaSimAddress(0)); SetForwardAddr(AquaSimAddress(0));
        SetDataType(0); SetNumForwards(0); SetOriginalSource(Vector());
        SetToken(0); SetTs(0); SetRange(0);
        SetExtraInfo_o(Vector()); SetExtraInfo_f(Vector());
        SetExtraInfo_t(Vector()); SetExtraInfo_d(Vector());
    }
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualVbfHeader")
            .SetParent<VBHeader>().AddConstructor<AquaVisualVbfHeader>();
        return tid;
    }
    TypeId GetInstanceTypeId() const override { return GetTypeId(); }
    void Serialize(Buffer::Iterator i) const override {
        // Legacy getters are non-const; serialize a value copy.
        auto h = *this;
        i.WriteU8(h.GetMessType()); i.WriteU32(h.GetPkNum());
        i.WriteU16(h.GetTargetAddr().GetAsInt()); i.WriteU16(h.GetSenderAddr().GetAsInt());
        i.WriteU16(h.GetForwardAddr().GetAsInt()); i.WriteU8(h.GetDataType());
        i.WriteU16(h.GetNumForwards()); WriteVector(i, h.GetOriginalSource());
        i.WriteU32(h.GetToken()); i.WriteU32(h.GetTs()); i.WriteU32(h.GetRange());
        auto extra = h.GetExtraInfo();
        WriteVector(i, extra.o); WriteVector(i, extra.f);
        WriteVector(i, extra.t); WriteVector(i, extra.d);
    }
    uint32_t Deserialize(Buffer::Iterator i) override {
        SetMessType(i.ReadU8()); SetPkNum(i.ReadU32());
        SetTargetAddr(AquaSimAddress(i.ReadU16())); SetSenderAddr(AquaSimAddress(i.ReadU16()));
        SetForwardAddr(AquaSimAddress(i.ReadU16())); SetDataType(i.ReadU8());
        SetNumForwards(i.ReadU16()); SetOriginalSource(ReadVector(i));
        SetToken(i.ReadU32()); SetTs(i.ReadU32()); SetRange(i.ReadU32());
        SetExtraInfo_o(ReadVector(i)); SetExtraInfo_f(ReadVector(i));
        SetExtraInfo_t(ReadVector(i)); SetExtraInfo_d(ReadVector(i));
        return GetSerializedSize();
    }
private:
    static void WriteVector(Buffer::Iterator& i, const Vector& v) {
        for (const auto value : {v.x, v.y, v.z}) {
            const double mm = std::round(value * 1000.0);
            if (!std::isfinite(mm) || mm < std::numeric_limits<int32_t>::min()
                || mm > std::numeric_limits<int32_t>::max())
                throw std::runtime_error("VBF coordinate exceeds signed millimeter header range");
            i.WriteU32(static_cast<uint32_t>(static_cast<int32_t>(mm)));
        }
    }
    static Vector ReadVector(Buffer::Iterator& i) {
        const auto read = [&i]() {
            const uint32_t raw = i.ReadU32();
            const int64_t mm = raw <= INT32_MAX ? int64_t(raw) : int64_t(raw) - (int64_t(1) << 32);
            return static_cast<double>(mm) / 1000.0;
        };
        const double x = read(), y = read(), z = read();
        return Vector(x, y, z);
    }
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualVbfHeader);
} // namespace ns3

/* -*- Mode:C++; c-file-style:"gnu"; indent-tabs-mode:nil; -*- */
/*
 * Copyright (c) 2016 University of Connecticut
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 as
 * published by the Free Software Foundation;
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 *
 * Author: Robert Martin <robert.martin@engr.uconn.edu>
 */

#ifndef AQUA_SIM_ROUTING_VBF_H
#define AQUA_SIM_ROUTING_VBF_H

#include "ns3/aqua-sim-address.h"
#include "ns3/aqua-sim-channel.h"
#include "ns3/aqua-sim-datastructure.h"
#include "ns3/aqua-sim-routing.h"

#include "ns3/packet.h"
#include "ns3/random-variable-stream.h"
#include "ns3/vector.h"

#include <map>

namespace ns3
{


struct vbf_neighborhood
{
    int number;
    Vector neighbor[MAX_NEIGHBOR];
};

typedef std::pair<AquaSimAddress, unsigned int> hash_entry;

/**
 * \ingroup aqua-sim-ng
 *
 * \brief Packet Hash table for VBF to assist in specialized tables.
 */
class AquaSimPktHashTable
{
  public:
    std::map<hash_entry, vbf_neighborhood*> m_htable;
    // std::map<hash_t, hash_entry> m_htable;

    AquaSimPktHashTable();
    ~AquaSimPktHashTable();

    int m_windowSize{WINDOW_SIZE};
    void Reset();
    void PutInHash(AquaSimAddress sAddr, unsigned int pkNum);
    void PutInHash(AquaSimAddress sAddr, unsigned int pkNum, Vector p);
    vbf_neighborhood* GetHash(AquaSimAddress senderAddr, unsigned int pkt_num);
    // private:
    // int lower_counter;
}; // class AquaSimPktHashTable

/**
 * \brief Packet Hash table for VBF to assist in specialized tables.
 */
class AquaSimDataHashTable
{
  public:
    std::map<int*, int*> m_htable;
    // Tcl_HashTable htable;

    AquaSimDataHashTable();
    ~AquaSimDataHashTable();

    void Reset();
    void PutInHash(int* attr);
    int* GetHash(int* attr);
}; // class AquaSimDataHashTable

/**
 * \brief Vector Based Forwarding
 * http://engr.uconn.edu/~jcui/UWSN_papers/vbf_networking2006.pdf
 */
class AquaSimVBF : public AquaSimRouting
{
  public:
    AquaSimVBF();
    static TypeId GetTypeId();
    int64_t AssignStreams(int64_t stream) override;
    bool TxProcess(Ptr<Packet> packet, const Address& dest, uint16_t protocolNumber) override;
    bool Recv(Ptr<Packet> packet, const Address& dest, uint16_t protocolNumber) override;

    void SetTargetPos(Vector pos);
    // AquaSimVBF_Entry routing_table[MAX_DATA_TYPE];

  protected:
    int m_pkCount;
    int m_counter;
    int m_hopByHop;
    int m_enableRouting; // if true, VBF can perform routing functionality. Otherwise, not perform
    // int m_useOverhear;
    double m_priority;
    bool m_measureStatus;
    // int m_portNumber;
    AquaSimPktHashTable PktTable;
    AquaSimPktHashTable SourceTable;
    AquaSimPktHashTable Target_discoveryTable;
    AquaSimPktHashTable SinkTable;

    double m_width;
    // the width is used to test if the node is close enough to the path specified by the packet
    Vector m_targetPos;
    Ptr<UniformRandomVariable> m_rand;

    void Terminate();
    void Reset();
    void ConsiderNew(Ptr<Packet> pkt);
    void SetDelayTimer(Ptr<Packet>, double);
    void Timeout(Ptr<Packet>);
    double Advance(Ptr<Packet>);
    double Distance(Ptr<Packet>);
    double Projection(Ptr<Packet>);
    double CalculateDelay(Ptr<Packet>, Vector*);
    // double RecoveryDelay(Ptr<Packet>, Vector*);
    void CalculatePosition(Ptr<Packet>);
    void SetMeasureTimer(Ptr<Packet>, double);
    bool IsTarget(Ptr<Packet>);
    bool IsCloseEnough(Ptr<Packet>);

    Ptr<Packet> CreatePacket();
    Ptr<Packet> PrepareMessage(unsigned int dtype, AquaSimAddress to_addr, int msg_type);

    void DataForSink(Ptr<Packet> pkt);
    void StopSource();
    void MACprepare(Ptr<Packet> pkt);
    void MACsend(Ptr<Packet> pkt, double delay = 0);

    void DoDispose() override;
}; // class AquaSimVBF

} // namespace ns3

#endif /* AQUA_SIM_ROUTING_VBF_H */

/* -*- Mode:C++; c-file-style:"gnu"; indent-tabs-mode:nil; -*- */
/*
 * Copyright (c) 2016 University of Connecticut
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 as
 * published by the Free Software Foundation;
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 *
 * Author: Robert Martin <robert.martin@engr.uconn.edu>
 */


#include "ns3/aqua-sim-header-routing.h"
#include "ns3/aqua-sim-header.h"
#include "ns3/aqua-sim-propagation.h"
#include "ns3/aqua-sim-pt-tag.h"
#include "ns3/aqua-sim-trailer.h"

#include "ns3/double.h"
#include "ns3/integer.h"
#include "ns3/log.h"
#include "ns3/mobility-model.h"
#include "ns3/simulator.h"

#include <iostream>
namespace ns3 {

NS_LOG_COMPONENT_DEFINE("AquaSimVBF");

AquaSimPktHashTable::AquaSimPktHashTable()
{
    NS_LOG_FUNCTION(this);
    //  lower_counter=0;
    // 50 items in the hash table, however, because it begins by 0, so, minus 1
    // Tcl_InitHashTable(&m_htable, 3);
}

AquaSimPktHashTable::~AquaSimPktHashTable()
{
    NS_LOG_FUNCTION(this);
    for (std::map<hash_entry, vbf_neighborhood*>::iterator it = m_htable.begin();
         it != m_htable.end();
         ++it)
    {
        delete it->second;
    }
    m_htable.clear();
}

void
AquaSimPktHashTable::Reset()
{
    for (const auto& entry : m_htable) delete entry.second;
    m_htable.clear();
    /*
      vbf_neighborhood *hashPtr;
      Tcl_HashEntry *entryPtr;
      Tcl_HashSearch searchPtr;

      entryPtr = Tcl_FirstHashEntry(&m_htable, &searchPtr);
      while (entryPtr != NULL) {
          hashPtr = (vbf_neighborhood *)Tcl_GetHashValue(entryPtr);
          delete hashPtr;
          Tcl_DeleteHashEntry(entryPtr);
          entryPtr = Tcl_NextHashEntry(&searchPtr);
      }
    */
}

vbf_neighborhood*
AquaSimPktHashTable::GetHash(AquaSimAddress senderAddr, unsigned int pk_num)
{
    hash_entry entry = std::make_pair(senderAddr, pk_num);
    std::map<hash_entry, vbf_neighborhood*>::iterator it;

    it = m_htable.find(entry);

    if (it == m_htable.end())
    {
        return NULL;
    }

    return it->second;
    /*
    unsigned int key[3];

      key[0] = senderAddr;
      key[1] = 0; //sender_id.port_;
      key[2] = pk_num;

      Tcl_HashEntry *entryPtr = Tcl_FindHashEntry(&m_htable, (char *)key);

      if (entryPtr == NULL )
          return NULL;

      return (vbf_neighborhood *)Tcl_GetHashValue(entryPtr);
    */
}

void
AquaSimPktHashTable::PutInHash(AquaSimAddress sAddr, unsigned int pkNum)
{
    // Tcl_HashEntry *entryPtr;
    //  Pkt_Hash_Entry    *hashPtr;
    vbf_neighborhood* hashPtr;
    // unsigned int key[3];
    // bool newPtr = true;

    // key[1]=0; //(vbh->sender_id).port_;
    hash_entry entry = std::make_pair(sAddr, pkNum);
    std::map<hash_entry, vbf_neighborhood*>::iterator it;

    const auto k = pkNum > static_cast<unsigned>(m_windowSize) ? pkNum - m_windowSize : 0;
    if (k > 0) // TODO verify this in future work
    {
        auto old = m_htable.lower_bound(std::make_pair(sAddr, 0u));
        while (old != m_htable.end() && old->first.first == sAddr && old->first.second < k)
        {
            delete old->second;
            old = m_htable.erase(old);
        }
    }

    entry.second = pkNum;
    hashPtr = GetHash(sAddr, pkNum);
    // entryPtr = Tcl_CreateHashEntry(&m_htable, (char *)key, &newPtr);
    if (hashPtr != NULL)
    {
        int m = hashPtr->number;
        if (m < MAX_NEIGHBOR)
        {
            hashPtr->number++;
            hashPtr->neighbor[m].x = 0;
            hashPtr->neighbor[m].y = 0;
            hashPtr->neighbor[m].z = 0;
        }
        return;
    }
    hashPtr = new vbf_neighborhood();
    hashPtr->number = 1;
    hashPtr->neighbor[0].x = 0;
    hashPtr->neighbor[0].y = 0;
    hashPtr->neighbor[0].z = 0;
    std::pair<hash_entry, vbf_neighborhood*> newPair;
    newPair.first = entry;
    newPair.second = hashPtr;
    if (m_htable.insert(newPair).second == false)
    {
        delete newPair.second;
    }
    // Tcl_SetHashValue(entryPtr, hashPtr);
}

void
AquaSimPktHashTable::PutInHash(AquaSimAddress sAddr, unsigned int pkNum, Vector p)
{
    NS_LOG_DEBUG("PutinHash begin:" << sAddr << "," << pkNum << ",(" << p.x << "," << p.y << ","
                                    << p.z << ")");
    // Tcl_HashEntry *entryPtr;
    //  Pkt_Hash_Entry    *hashPtr;
    vbf_neighborhood* hashPtr;
    // unsigned int key[3];
    // bool newPtr = true;

    // key[1]=0; //(vbh->sender_id).port_;
    hash_entry entry = std::make_pair(sAddr, pkNum);
    std::map<hash_entry, vbf_neighborhood*>::iterator it;
    const auto k = pkNum > static_cast<unsigned>(m_windowSize) ? pkNum - m_windowSize : 0;
    if (k > 0)
    {
        auto old = m_htable.lower_bound(std::make_pair(sAddr, 0u));
        while (old != m_htable.end() && old->first.first == sAddr && old->first.second < k)
        {
            delete old->second;
            old = m_htable.erase(old);
        }
    }

    entry.second = pkNum;
    hashPtr = GetHash(sAddr, pkNum);
    // entryPtr = Tcl_CreateHashEntry(&m_htable, (char *)key, &newPtr);
    if (hashPtr != NULL)
    {
        int m = hashPtr->number;
        // printf("hash_table: this is not old item, there are %d item inside\n",m);
        if (m < MAX_NEIGHBOR)
        {
            hashPtr->number++;
            hashPtr->neighbor[m].x = p.x;
            hashPtr->neighbor[m].y = p.y;
            hashPtr->neighbor[m].z = p.z;
        }
        return;
    }
    hashPtr = new vbf_neighborhood();
    hashPtr->number = 1;
    hashPtr->neighbor[0].x = p.x;
    hashPtr->neighbor[0].y = p.y;
    hashPtr->neighbor[0].z = p.z;
    std::pair<hash_entry, vbf_neighborhood*> newPair;
    newPair.first = entry;
    newPair.second = hashPtr;
    if (m_htable.insert(newPair).second == false)
    {
        delete newPair.second;
    }
    // Tcl_SetHashValue(entryPtr, hashPtr);
}

AquaSimDataHashTable::AquaSimDataHashTable()
{
    NS_LOG_FUNCTION(this);
    Reset();
    // Tcl_InitHashTable(&htable, MAX_ATTRIBUTE);
}

AquaSimDataHashTable::~AquaSimDataHashTable()
{
    NS_LOG_FUNCTION(this);
    Reset();
}

void
AquaSimDataHashTable::Reset()
{
    for (std::map<int*, int*>::iterator it = m_htable.begin(); it != m_htable.end(); ++it)
    {
        delete it->first;
        delete it->second;
    }
    m_htable.clear();
    /*
      Tcl_HashEntry *entryPtr;
      Tcl_HashSearch searchPtr;

      entryPtr = Tcl_FirstHashEntry(&htable, &searchPtr);
      while (entryPtr != NULL) {
          Tcl_DeleteHashEntry(entryPtr);
          entryPtr = Tcl_NextHashEntry(&searchPtr);
      }
    */
}

int*
AquaSimDataHashTable::GetHash(int* attr)
{
    std::map<int*, int*>::iterator it;
    it = m_htable.find(attr);
    if (it == m_htable.end())
    {
        return NULL;
    }

    return it->second;
}

void
AquaSimDataHashTable::PutInHash(int* attr)
{
    // bool newPtr = true;

    // Tcl_HashEntry* entryPtr=Tcl_CreateHashEntry(&htable, (char *)attr, &newPtr);
    if (m_htable.count(attr) > 0)
    {
        return;
    }

    int* hashPtr = new int[1];
    hashPtr[0] = 1;
    m_htable.insert(std::pair<int*, int*>(attr, hashPtr));
    // Tcl_SetHashValue(entryPtr, hashPtr);
}

NS_OBJECT_ENSURE_REGISTERED(AquaSimVBF);

AquaSimVBF::AquaSimVBF()
{
    // Initialize variables.
    //  printf("VB initialized\n");
    m_pkCount = 0;
    // TODO
    m_width = 2500;
    // m_width=0;
    m_counter = 0;
    m_priority = 1.2;
    // m_priority=2;
    // m_useOverhear = 0;
    m_enableRouting = 1;
    m_targetPos = Vector();
    m_rand = CreateObject<UniformRandomVariable>();
}

TypeId
AquaSimVBF::GetTypeId()
{
    static TypeId tid = TypeId("ns3::AquaSimVBF")
                            .SetParent<AquaSimRouting>()
                            .AddConstructor<AquaSimVBF>()
                            .AddAttribute("HopByHop",
                                          "Hop by hop VBF setting. Default 0 is false.",
                                          IntegerValue(0),
                                          MakeIntegerAccessor(&AquaSimVBF::m_hopByHop),
                                          MakeIntegerChecker<int>())
                            .AddAttribute("EnableRouting",
                                          "Enable routing VBF setting. Default 1 is true.",
                                          IntegerValue(1),
                                          MakeIntegerAccessor(&AquaSimVBF::m_enableRouting),
                                          MakeIntegerChecker<int>())
                            .AddAttribute("Width",
                                          "Radius of the VBF forwarding pipe in meters. Default is 2500.",
                                          DoubleValue(2500),
                                          // DoubleValue(100),
                                          MakeDoubleAccessor(&AquaSimVBF::m_width),
                                          MakeDoubleChecker<double>(std::numeric_limits<double>::min()))
                            .AddAttribute("TargetPos",
                                          "Position of target sink (x,y,z).",
                                          Vector3DValue(),
                                          MakeVector3DAccessor(&AquaSimVBF::m_targetPos),
                                          MakeVector3DChecker());
    return tid;
    // bind("m_useOverhear_", &m_useOverhear);
}

int64_t
AquaSimVBF::AssignStreams(int64_t stream)
{
    NS_LOG_FUNCTION(this << stream);
    m_rand->SetStream(stream);
    return 1;
}

// 传输层调用Txprocess
bool
AquaSimVBF::TxProcess(Ptr<Packet> packet, const Address& dest, uint16_t protocolNumber)
{
    AquaVisualVbfHeader vbh;

    vbh.SetSenderAddr(AquaSimAddress::ConvertFrom(m_device->GetAddress()));
    vbh.SetTargetAddr(AquaSimAddress::ConvertFrom(dest));
    packet->AddHeader(vbh);

    return Recv(packet, dest, protocolNumber);
}

// MAC层的包调用Recv
bool
AquaSimVBF::Recv(Ptr<Packet> packet, const Address& dest, uint16_t protocolNumber)
{
    NS_LOG_FUNCTION(this);
    NS_LOG_DEBUG("================Recv=================\n");

    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;

    packet->RemoveHeader(vbh);
    packet->RemoveTrailer(tra);
    // std::cout<<"Recv packet:"<<packet<<"\n";
    // std::cout<<"ash.GetNumForwards:"<<ash.GetNumForwards()<<"\n";
    if (vbh.GetMessType() != AS_DATA)
    {
        // no headers //TODO create specalized Application instead of using this hack.// how many
        // times this pkt was forwarded
        tra.SetNextHop(AquaSimAddress::GetBroadcast());
        tra.SetSAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));
        tra.SetDAddr(AquaSimAddress::ConvertFrom(dest));

        vbh.SetMessType(AS_DATA);
        vbh.SetSenderAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));
        vbh.SetForwardAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));
        vbh.SetTargetAddr(AquaSimAddress::ConvertFrom(dest));
        vbh.SetPkNum(packet->GetUid());

        // set position error    //todo

        Ptr<Object> sObject = GetDevice()->GetNode();
        Ptr<MobilityModel> sModel = sObject->GetObject<MobilityModel>();

        // todo
        // GetDevice()->SetRouting(this);
        vbh.SetOriginalSource(sModel->GetPosition());
        vbh.SetExtraInfo_f(sModel->GetPosition());

        vbh.SetExtraInfo_t(m_targetPos);
        vbh.SetExtraInfo_o(sModel->GetPosition());
        NS_LOG_DEBUG("source position:x:" << sModel->GetPosition().x
                  << " y:" << sModel->GetPosition().y << " z:" << sModel->GetPosition().z);
        NS_LOG_DEBUG("Recv-addheader\n");

        packet->AddHeader(vbh);
    }
    else
    {
        packet->AddHeader(vbh);
        packet->PeekHeader(vbh);
        // ignoring forward iterator, but this can be simply changed if necessary
    }

    packet->AddTrailer(tra);
    // unsigned char msg_type =vbh.GetMessType();  //unused
    // unsigned int dtype = vbh.GetDataType();  //unused
    // double t1=vbh.GetTs();  //unused

    if (!m_enableRouting)
    {
        if (vbh.GetMessType() != AS_DATA)
        {
            packet = 0;
            NS_LOG_DEBUG("vbf recv vbh.GetMessType() != AS_DATA vbh.GetMessType():"
                      << vbh.GetMessType());
            return false;
        }
        NS_LOG_DEBUG("vbh.GetTargetAddr():" << vbh.GetTargetAddr() << " GetDevice()->GetAddress()"
                  << GetDevice()->GetAddress());

        if (vbh.GetSenderAddr() == GetDevice()->GetAddress())
        {
            MACprepare(packet);
            MACsend(packet, (m_rand->GetValue() * JITTER));
            NS_LOG_DEBUG("Recv macsend\n");
        }
        else if (vbh.GetTargetAddr() == GetDevice()->GetAddress())
        {
            DataForSink(packet);
            NS_LOG_DEBUG("Recv data for sink\n");
        }
        return true;
    }

    vbf_neighborhood* hashPtr = PktTable.GetHash(vbh.GetSenderAddr(), vbh.GetPkNum());
    // Received this packet before ?

    if (hashPtr != NULL)
    {
        PktTable.PutInHash(vbh.GetSenderAddr(), vbh.GetPkNum(), vbh.GetExtraInfo().f);
        packet = 0;
        Ptr<Object> sObject = GetDevice()->GetNode();
        Ptr<MobilityModel> sModel = sObject->GetObject<MobilityModel>();
        NS_LOG_DEBUG("hashPtr != NULL position.x:" << sModel->GetPosition().x
                  << "position.y:" << sModel->GetPosition().y
                  << "position.z:" << sModel->GetPosition().z);
        NS_LOG_DEBUG("vbf hashPtr != null");
        return false;
        // printf("vectrobasedforward: this is duplicate packet\n");
    }
    else
    {
        // Never receive it before ? Put in hash table.
        // printf("vectrobasedforward: this is new packet\n");
        NS_LOG_DEBUG("Recv nevev receive it before\n");
        PktTable.PutInHash(vbh.GetSenderAddr(), vbh.GetPkNum(), vbh.GetExtraInfo().f);

        Ptr<Object> sObject = GetDevice()->GetNode();
        Ptr<MobilityModel> sModel = sObject->GetObject<MobilityModel>();
        // Todo
        NS_LOG_DEBUG("position.x:" << sModel->GetPosition().x
                  << "position.y:" << sModel->GetPosition().y
                  << "position.z:" << sModel->GetPosition().z);
        // todo end
        Vector forwarder = vbh.GetExtraInfo().f;

        packet->RemoveHeader(vbh);
        Vector d = Vector(sModel->GetPosition().x - forwarder.x,
                          sModel->GetPosition().y - forwarder.y,
                          sModel->GetPosition().z - forwarder.z);
        vbh.SetExtraInfo_d(d);
        packet->AddHeader(vbh);

        ConsiderNew(packet);
    }

    return true;
}

void
AquaSimVBF::ConsiderNew(Ptr<Packet> pkt)
{
    // std::cout << "===========vbf: considerNew===========\n";
    NS_LOG_FUNCTION(this);

    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;

    pkt->PeekHeader(vbh);
    // Todo
    double tx = vbh.GetExtraInfo().t.x;
    double ty = vbh.GetExtraInfo().t.y;
    double tz = vbh.GetExtraInfo().t.z;
    NS_LOG_DEBUG("consider new begin : Advance target position is:" << tx << "," << ty << "," << tz
              << '\n');
    Vector pos = GetDevice()->GetPosition();
    NS_LOG_DEBUG("consider new begin : Advance current position is:" << pos.x << "," << pos.y << ","
              << pos.z << '\n');
    // todo end

    unsigned char msg_type = vbh.GetMessType();
    // unsigned int dtype = vbh.GetDataType();  //unused
    double l; //,h;  //unused
              // JITTER=0.1;use to generate random
    // Pkt_Hash_Entry *hashPtr;
    vbf_neighborhood* hashPtr;
    //  Agent_List *agentPtr;
    // PrvCurPtr  RetVal;
    AquaSimAddress from_nodeAddr; //, forward_nodeAddr;zhuan fa qi

    Ptr<Packet> gen_pkt;
    AquaVisualVbfHeader gen_vbh;

    //  printf("Vectorbasedforward:oops!\n");
    switch (msg_type)
    {
    case INTEREST:
        NS_LOG_DEBUG("===========vbf: INTEREST===========\n");
        // printf("Vectorbasedforward:it is interest packet!\n");
        hashPtr = PktTable.GetHash(vbh.GetSenderAddr(), vbh.GetPkNum());
        NS_LOG_INFO("ConsiderNew: INTEREST, hashptr #=" << hashPtr->number);
        // Check if it comes from sink agent of this node
        // If so we have to keep it in sink list

        from_nodeAddr = vbh.GetSenderAddr();
        // forward_nodeAddr = vbh.GetForwardAddr();
        //   printf("Vectorbasedforward:it the from_nodeaddr is %d %d  and theb this node id is %d
        //   ,%d!\n", from_nodeAddr,from_nodeID.port_,THIS_NODE.addr_,THIS_NODE.port_ );

        if (GetDevice()->GetAddress() == from_nodeAddr)
        {
            MACprepare(pkt);
            MACsend(pkt, m_rand->GetValue() * JITTER);
            //  printf("vectorbasedforward: after MACprepare(pkt)\n");
        }
        else
        {
            // CalculatePosition(pkt); not necessary with mobilitymodel
            // printf("vectorbasedforward: This packet is from different node\n");
            if (IsTarget(pkt))
            {
                // If this node is target?
                l = Advance(pkt); // l=0?

                //    if (!SendUp(p))
                //	     NS_LOG_WARN("DataForSink: Something went wrong when passing packet up to
                // dmux.");
                //  printf("vectorbasedforward:%d send out the source-discovery \n",here_.addr_);
                //  pkt->RemoveHeader(ash);
                pkt->RemoveHeader(vbh);
                vbh.SetMessType(SOURCE_DISCOVERY);
                pkt->AddHeader(vbh);
                // pkt->AddHeader(ash);
                SetDelayTimer(pkt, l * JITTER);
                // !!! need to re-think
            }
            else
            {
                // CalculatePosition(pkt);
                // No the target forwared
                l = Advance(pkt);
                // h=Projection(pkt);  //never used...
                if (IsCloseEnough(pkt))
                {
                    // printf("vectorbasedforward:%d I am close enough for the
                    // interest\n",here_.addr_);
                    MACprepare(pkt);
                    MACsend(pkt, m_rand->GetValue() * JITTER); //!!!! need to re-think
                }
                else
                {
                    //  printf("vectorbasedforward:%d I am not close enough for the interest
                    //  \n",here_.addr_);
                    pkt = 0;
                }
            }
        }
        // pkt=0;
        return;

    case TARGET_DISCOVERY:
        NS_LOG_DEBUG("===========vbf: Target_DISCOVERY==========\n");
        // from other nodes hitted by the packet, it is supposed
        // to be the one hop away from the sink

        // printf("Vectorbasedforward(%d,%d):it is target-discovery  packet(%d)! it target id is %d
        // coordinate is %f,%f,%f and range is
        // %f\n",here_.addr_,here_.port_,vbh.GetPkNum(),vbh.GetTargetAddr(),vbh.GetExtraInfo().t.x,
        // vbh.GetExtraInfo().t.y,vbh.GetExtraInfo().t.z,vbh.GetRange());
        if (GetDevice()->GetAddress() == vbh.GetTargetAddr())
        {
            // printf("Vectorbasedforward(%d,??%d):it is target-discovery  packet(%d)! it target id
            // is %d  coordinate is %f,%f,%f and range is
            // %f\n",here_.addr_,here_.port_,vbh.GetPkNum(),vbh.GetTargetAddr(),vbh.GetExtraInfo().t.x,
            // vbh.GetExtraInfo().t.y,vbh.GetExtraInfo().t.z,vbh.GetRange());
            //  AquaSimAddress *hashPtr= PktTable.GetHash(vbh.GetSenderAddr(), vbh.GetPkNum());
            //  Received this packet before ?
            //  if (hashPtr == NULL) {

            // CalculatePosition(pkt); not necessary with mobilitymodel
            DataForSink(pkt);
            NS_LOG_INFO("AquaSimVBF::ConsiderNew: target is " << GetDevice()->GetAddress());
            // } //New data Process this data
            //
        }
        else
        {
            pkt = 0;
        }
        return;

    case SOURCE_DISCOVERY:
        NS_LOG_DEBUG("===========vbf: source_discovery===========\n");
        pkt = 0;
        // other nodes already claim to be the source of this interest
        //   SourceTable.PutInHash(vbh);
        return;

    case DATA_READY:
        NS_LOG_DEBUG("===========vbf:data_ready==========\n");
        //  printf("Vectorbasedforward(%d,%d):it is data ready packet(%d)! it target id is %d
        //  \n",here_.addr_,here_.port_,vbh->pk_num,vbh->target_id.addr_);
        from_nodeAddr = vbh.GetSenderAddr();
        if (GetDevice()->GetAddress() == from_nodeAddr)
        {
            // come from the same node, broadcast it
            MACprepare(pkt);
            MACsend(pkt, m_rand->GetValue() * JITTER);
            return;
        }
        // CalculatePosition(pkt); not necessary with mobilitymodel
        if (GetDevice()->GetAddress() == vbh.GetTargetAddr())
        {
            NS_LOG_INFO("AquaSimVBF::ConsiderNew: target is " << GetDevice()->GetAddress());
            DataForSink(pkt); // process it
        }
        else
        {
            // printf("Vectorbasedforward: %d is the not  target\n", here_.addr_);
            MACprepare(pkt);
            MACsend(pkt, m_rand->GetValue() * JITTER);
        }
        return;

        /*
           case DATA_READY :

           // put source_agent in source list of routing table
           agentPtr = new Agent_List;
           AGT_ADDR(agentPtr) = vbh.GetSenderAddr();
           agentPtr->next = routing_table[dtype].source;
           routing_table[dtype].source = agentPtr;

           // !! this part will be modified later
           God::instance()->AddSource(dtype, (vbh.GetSenderAddr()));

           gen_pkt = PrepareMessage(dtype, vbh.GetSenderAddr(), DATA_REQUEST);
           gen_vbh = HDR_UWVB(gen_pkt);
           //      gen_vbh->report_rate = ORIGINAL;
         if (!SendUp(p))
            NS_LOG_WARN("DataForSink: Something went wrong when passing packet up to dmux.");
           pkt=0;
           return;
         */

    case AS_DATA:
        NS_LOG_DEBUG("===========vbf: as data===========\n");
        NS_LOG_INFO("AquaSimVBF::ConsiderNew: data packet");

        // std::cout<<"considerNew as_data current
        // node:"<<GetDevice()->GetNode()->GetObject<Node>()->GetId()<<"\n"; std::cout<< "Node
        // "<<AquaSimAddress::ConvertFrom(m_device->GetAddress()).GetAsInt()<<" MAC Layer Send
        // down"<<std::endl; std::cout<<"considerNew as_data current node
        // position:"<<GetDevice()->GetAddress()<<"\n"; printf("Vectorbasedforward(%d,%d):it is data
        // packet(%d)! it target id is %d  coordinate is %f,%f,%f and range is
        // %f\n",here_.addr_,here_.port_,vbh->pk_num,vbh->target_id.addr_,vbh->info.tx,
        // vbh->info.ty,vbh->info.tz,vbh->range); printf("Vectorbasedforward(%d):it is data
        // packet(%d)\n",here_.addr_,vbh->pk_num);
        from_nodeAddr = vbh.GetSenderAddr();
        // TODO
        if (GetDevice()->GetAddress() == from_nodeAddr)
        {
            // come from the same node, broadcast it
            NS_LOG_DEBUG("considerNew_MACsssend\n");
            MACprepare(pkt);
            MACsend(pkt, 0);
            return;
        }
        // CalculatePosition(pkt); not necessary with mobilitymodel
        //   printf("vectorbasedforward: after MACprepare(pkt)\n");
        l = Advance(pkt);
        // h=Projection(pkt);  //never used...
        NS_LOG_DEBUG("considerNew as_data forwardnodeaddr:" << vbh.GetSenderAddr() << "\n");
        NS_LOG_DEBUG("considerNew_as_data l:" << l << "\n");

        if (GetDevice()->GetAddress() == vbh.GetTargetAddr())
        {
            // printf("Vectorbasedforward: %d is the target\n", here_.addr_);
            DataForSink(pkt); // process it
            NS_LOG_DEBUG("considerNew_as_data data for sink\n");
        }

        else
        {
            //  printf("Vectorbasedforward: %d is the not  target\n", here_.addr_);
            // TODO iscloseenough return false,surely,so pkt=0
            if (IsCloseEnough(pkt))
            {
                NS_LOG_DEBUG("ConsiderNew as_data isclosenough\n");
                Vector* p1;
                p1 = new Vector[1];
                p1[0].x = vbh.GetExtraInfo().f.x;
                p1[0].y = vbh.GetExtraInfo().f.y;
                p1[0].z = vbh.GetExtraInfo().f.z;
                double delay = CalculateDelay(
                    pkt,
                    p1); // TODO should just pass the Vector for easier memory management here.
                delete[] p1;
                double d2 = (Distance(pkt) - m_device->GetPhy()->GetTransRange()) /
                            ns3::SOUND_SPEED_IN_WATER; // gettransrange=0
                // printf("Vectorbasedforward: I am  not  target delay is %f d2=%f
                // distance=%f\n",(sqrt(delay)*DELAY+d2*2),d2,Distance(pkt)); std::cout << "DElay is
                // " << (sqrt(delay)*DELAY+d2*2) << " d2 is " << d2 << " distance is " <<
                // Distance(pkt) << "\n";
                SetDelayTimer(pkt, (sqrt(delay) * DELAY + d2 * 2)); // set Tdelay=1.0
            }
            else
            {
                pkt = 0;
            }
        }
        return;

    default:

        pkt = 0;
        break;
    }
}

void
AquaSimVBF::Reset()
{
    PktTable.Reset();
    /*
       for (int i=0; i<MAX_DATA_TYPE; i++) {
       routing_table[i].Reset();
       }
     */
}

void
AquaSimVBF::Terminate()
{
    NS_LOG_DEBUG("AquaSimVBF::Terminate: Node="
                 << GetDevice()->GetAddress()
                 << ": remaining energy=" << GetDevice()->GetEnergyModel()->GetEnergy()
                 << ", initial energy=" << GetDevice()->GetEnergyModel()->GetInitialEnergy());
}

void
AquaSimVBF::StopSource()
{
    /*
       Agent_List *cur;

       for (int i=0; i<MAX_DATA_TYPE; i++) {
       for (cur=routing_table[i].source; cur!=NULL; cur=AGENT_NEXT(cur) ) {
       SEND_MESSAGE(i, AGT_ADDR(cur), DATA_STOP);
       }
       }
     */
}

Ptr<Packet>
AquaSimVBF::CreatePacket()
{
    NS_LOG_FUNCTION(this);

    Ptr<Packet> pkt = Create<Packet>();

    if (!pkt)
    {
        return NULL;
    }

    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;
    // ash.SetSize(36);
    vbh.SetTs(Simulator::Now().ToDouble(Time::S));

    //!! I add new part

    vbh.SetExtraInfo_o(GetDevice()->GetPosition());
    vbh.SetExtraInfo_f(GetDevice()->GetPosition());

    pkt->AddHeader(vbh);
    pkt->AddTrailer(tra);
    return pkt;
}

Ptr<Packet>
AquaSimVBF::PrepareMessage(unsigned int dtype, AquaSimAddress to_addr, int msg_type)
{
    NS_LOG_DEBUG("-----------vbf PrepareMessage-----------\n");
    Ptr<Packet> pkt = Create<Packet>();
    AquaVisualVbfHeader vbh;

    vbh.SetMessType(msg_type);
    vbh.SetPkNum(m_pkCount);
    m_pkCount++;
    vbh.SetSenderAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));
    vbh.SetDataType(dtype);
    vbh.SetForwardAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));

    vbh.SetTs(Simulator::Now().ToDouble(Time::S));
    //    vbh->num_next = 1;
    // I am not sure if we need this
    // vbh->next_nodes[0] = to_addr;

    // I am not sure if we need it?
    /*
       iph->src_ = here_;
       iph->dst_ = to_addr;
     */
    pkt->AddHeader(vbh);

    return pkt;
}

void
AquaSimVBF::MACprepare(Ptr<Packet> pkt)
{
    // std::cout << "-----------vbf MACprepare-----------\n";
    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;

    pkt->RemoveHeader(vbh);
    pkt->RemoveTrailer(tra);
    vbh.SetForwardAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));

    // printf("vectorbased: the mac_Broadcast is:%d\n",MAC_BROADCAST);
    tra.SetNextHop(AquaSimAddress::GetBroadcast());
    // ash.addr_type() = NS_AF_ILINK;
    //  ash.SetTxTime(Seconds(0));
    //  printf("vectorbased: the address type is :%d and suppose to be %d and  nexthop %d MAC_BROAD
    //  %d\n", ash->addr_type(),NS_AF_ILINK,ash->next_hop(),MAC_BROADCAST);
    // ash.SetDirection(AquaSimHeader::DOWN);

    /*if(!GetDevice()->GetSinkStatus()) {       //!! I add new part
    f = Vector(GetDevice()->CX(),
                  GetDevice()->CY(),
                  GetDevice()->CZ());
    }
    else{*/
    Ptr<MobilityModel> model = GetDevice()->GetNode()->GetObject<MobilityModel>();
    //}
    vbh.SetExtraInfo_f(model->GetPosition());

    pkt->AddHeader(vbh);
    pkt->AddTrailer(tra);
    // printf("vectorbasedforward: last line MACprepare\n");
}

void
AquaSimVBF::MACsend(Ptr<Packet> pkt, double delay)
{
    // std::cout << "-----------vbf MACsend-----------\n";
    NS_LOG_INFO("MACsend: delay " << delay << " at time " << Simulator::Now().GetSeconds());

    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;

    pkt->RemoveTrailer(tra);
    pkt->RemoveHeader(vbh);
    // pkt->RemovePacketTag(ptag);

    // I don't understand why it works like this way
    /*
       if (vbh.GetMessType() == AS_DATA)
       ash->size() = (God::instance()->data_pkt_size) + 4*(vbh.GetPkNum() - 1);
       else
       ash->size() = 36 + 4*(vbh.GetPkNum() -1);
     */

    /*
       if (vbh.GetMessType() == AS_DATA)
       // ash->size() = (God::instance()->data_pkt_size)+12 ;
       ash->size() = 65+12 ;
       else
       ash->size() =32;
     */

    // if(!ll) printf("ok, the LL is empty\n");
    // ptag.SetPacketType(PT_UWVB);
    // printf("vectorbased: the address type is :%d uid is %d\n", ash->addr_type(),pkt->uid_);
    // printf("vectorbased: the packet type is :%d\n", ptag.GetPacketType());
    //  ll->handle(pkt);
    pkt->AddHeader(vbh);
    pkt->AddTrailer(tra);

    Simulator::Schedule(Seconds(delay),
                        &AquaSimRouting::SendDown,
                        this,
                        pkt,
                        AquaSimAddress::GetBroadcast(),
                        Seconds(0));
}

void
AquaSimVBF::DataForSink(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;
    pkt->RemoveHeader(vbh);
    if (!SendUp(pkt))
    {
        NS_LOG_WARN("DataForSink: Something went wrong when passing packet up to dmux.");
    }
}

void
AquaSimVBF::SetDelayTimer(Ptr<Packet> pkt, double c)
{
    NS_LOG_FUNCTION(this << c);
    if (c < 0)
    {
        c = 0;
    }
    Simulator::Schedule(Seconds(c), &AquaSimVBF::Timeout, this, pkt);
}

void
AquaSimVBF::Timeout(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;

    pkt->PeekHeader(vbh);

    unsigned char msg_type = vbh.GetMessType();
    NS_LOG_DEBUG("Timeout:" << msg_type << "\n");
    vbf_neighborhood* hashPtr;
    // Ptr<Packet> p1;

    switch (msg_type)
    {
    case AS_DATA:
        hashPtr = PktTable.GetHash(vbh.GetSenderAddr(), vbh.GetPkNum());
        if (hashPtr != NULL)
        {
            int num_neighbor = hashPtr->number;
            NS_LOG_DEBUG("Timeout as_data n-neighbor:" << num_neighbor << "\n");
            // printf("vectorbasedforward: node %d have received %d when wake up at
            // %f\n",here_.addr_,num_neighbor,NOW);
            if (num_neighbor != 1)
            {
                /*AlohaOverhear can guarantee that the packet be successfully deliveried to next
                 * hop, so we release the pkt if overhearing other neighbors send this pkt.
                 */
                /* if( m_useOverhear )
                   {
                         pkt=0;
                         return;
                   }*/

                // Some guys transmit the data before me
                if (num_neighbor == MAX_NEIGHBOR)
                {
                    // I have too many neighbors, I quit
                    pkt = 0;
                    return;
                }
                else // I need to calculate my delay time again
                {
                    int i = 0;
                    Vector* tp;
                    tp = new Vector[1];

                    tp[0].x = hashPtr->neighbor[i].x;
                    tp[0].y = hashPtr->neighbor[i].y;
                    tp[0].z = hashPtr->neighbor[i].z;
                    double tdelay = CalculateDelay(pkt, tp);
                    // neighbor's tdelay
                    //  double tdelay=5;
                    i++;
                    double c = 1;
                    while (i < num_neighbor)
                    {
                        c = c * 2;
                        tp[0].x = hashPtr->neighbor[i].x;
                        tp[0].y = hashPtr->neighbor[i].y;
                        tp[0].z = hashPtr->neighbor[i].z;
                        double t2delay = CalculateDelay(pkt, tp);
                        if (t2delay < tdelay)
                        {
                            tdelay = t2delay;
                        }
                        i++;
                        NS_LOG_DEBUG("Timeout i:" << i << "calculatedelay:" << tdelay << "\n");
                    }

                    delete[] tp;
                    if (tdelay <= (m_priority / c))
                    {
                        MACprepare(pkt);
                        MACsend(pkt, 0);
                        NS_LOG_DEBUG("Timeout delay=a less than priority,then macsend\n");
                    }
                    else
                    {
                        pkt = 0; // to much overlap, don;t send
                    }
                } // end of calculate my new delay time
            }
            else
            { // I am the only neighbor
                Vector* tp;
                tp = new Vector[1];
                tp[0].x = vbh.GetExtraInfo().f.x;
                tp[0].y = vbh.GetExtraInfo().f.y;
                tp[0].z = vbh.GetExtraInfo().f.z;
                double delay = CalculateDelay(pkt, tp);
                NS_LOG_DEBUG("Timeout only neighbor delay:" << delay << "\n");
                delete[] tp;
                if (delay <= m_priority)
                {
                    // printf("vectorbasedforward: !!%f\n",delay);
                    MACprepare(pkt);
                    MACsend(pkt, 0);
                    NS_LOG_DEBUG("Timeout only neighbor and delay=a less than priority,then macsend\n");
                }
                else
                {
                    pkt = 0;
                }
                // printf("vectorbasedforward:  I%d am the only neighbor, I send it out at
                // %f\n",here_.addr_,NOW);
                return;
            }
        }
        break;
    default:
        pkt = 0;
        break;
    }
}

void
AquaSimVBF::CalculatePosition(Ptr<Packet> pkt)
{
    // not used.
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);
    auto f = vbh.GetExtraInfo().f;
    auto d = vbh.GetExtraInfo().d;
    auto c = f + d;
    // GetDevice()->SetPosition(c);
    printf("vectorbased: my position is computed as (%f,%f,%f)\n", c.x, c.y, c.z);
}

double
AquaSimVBF::CalculateDelay(Ptr<Packet> pkt, Vector* p1) // calculate a,rather than delay
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    double fx = p1->x;
    double fy = p1->y;
    double fz = p1->z;

    Vector pos = GetDevice()->GetPosition();
    double dx = pos.x - fx;
    double dy = pos.y - fy;
    double dz = pos.z - fz;

    double tx = vbh.GetExtraInfo().t.x;
    double ty = vbh.GetExtraInfo().t.y;
    double tz = vbh.GetExtraInfo().t.z;

    double dtx = tx - fx;
    double dty = ty - fy;
    double dtz = tz - fz;

    double dp = dx * dtx + dy * dty + dz * dtz;

    // double a=Advance(pkt);
    double p = Projection(pkt);
    double d = sqrt((dx * dx) + (dy * dy) + (dz * dz));
    double l = sqrt((dtx * dtx) + (dty * dty) + (dtz * dtz));
    double cos_theta;
    if (d == 0 || l == 0)
    {
        cos_theta = 0;
    }
    else
    {
        cos_theta = dp / (d * l);
    }
    // double delay=(TRANSMISSION_DISTANCE-d*cos_theta)/TRANSMISSION_DISTANCE;
    const double range = m_device->GetPhy()->GetTransRange();
    if (!std::isfinite(range) || range <= 0)
        throw std::runtime_error("VBF requires a positive finite PHY transRange");
    double delay = (p / m_width) + ((m_device->GetPhy()->GetTransRange() - d * cos_theta) /
                                    m_device->GetPhy()->GetTransRange());
    // double delay=(p/m_width) +((TRANSMISSION_DISTANCE-d)/TRANSMISSION_DISTANCE)+(1-cos_theta);
    // printf("vectorbased: node(%d) projection is %f, and cos is %f, and d is %f)\n",here_.addr_,p,
    // cos_theta, d);
    NS_LOG_DEBUG("CalculateDelay(" << GetDevice()->GetAddress() << ") projection is " << p
                                   << ", cos is " << cos_theta << " and d is " << d
                                   << " and total delay is " << delay);
    return std::max(0.0, delay);
}

double
AquaSimVBF::Distance(Ptr<Packet> pkt) // d
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    double tx = vbh.GetExtraInfo().f.x;
    double ty = vbh.GetExtraInfo().f.y;
    double tz = vbh.GetExtraInfo().f.z;
    // printf("vectorbased: the target is %lf,%lf,%lf \n",tx,ty,tz);
    Vector pos = GetDevice()->GetPosition();
    // double x=GetDevice()->CX(); //change later
    // double y=GetDevice()->CY();// printf(" Vectorbasedforward: I am in advanced\n");
    // double z=GetDevice()->CZ();
    //  printf("the target is %lf,%lf,%lf and my coordinates are %lf,%lf,%lf\n",tx,ty,tz,x,y,z);
    return sqrt((tx - pos.x) * (tx - pos.x) + (ty - pos.y) * (ty - pos.y) +
                (tz - pos.z) * (tz - pos.z));
}

double
AquaSimVBF::Advance(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    double tx = vbh.GetExtraInfo().t.x;
    double ty = vbh.GetExtraInfo().t.y;
    double tz = vbh.GetExtraInfo().t.z;
    // TODO
    NS_LOG_DEBUG("Advance target position is:" << tx << "," << ty << "," << tz << '\n');
    // printf("vectorbased: the target is %lf,%lf,%lf \n",tx,ty,tz);
    Vector pos = GetDevice()->GetPosition();
    NS_LOG_DEBUG("Advance current position is:" << pos.x << "," << pos.y << "," << pos.z << '\n');
    // double x=GetDevice()->CX(); //change later
    // double y=GetDevice()->CY();// printf(" Vectorbasedforward: I am in advanced\n");
    // double z=GetDevice()->CZ();
    //  printf("the target is %lf,%lf,%lf and my coordinates are %lf,%lf,%lf\n",tx,ty,tz,x,y,z);
    return sqrt((tx - pos.x) * (tx - pos.x) + (ty - pos.y) * (ty - pos.y) +
                (tz - pos.z) * (tz - pos.z));
}

double
AquaSimVBF::Projection(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    double tx = vbh.GetExtraInfo().t.x;
    double ty = vbh.GetExtraInfo().t.y;
    double tz = vbh.GetExtraInfo().t.z;

    Vector o;
    // double ox, oy, oz;
    NS_LOG_DEBUG("m_hopByHop:" << m_hopByHop);
    if (!m_hopByHop)
    {
        NS_LOG_DEBUG("enter !m_hopByHop");
        // printf("vbf is used\n");
        o.x = vbh.GetExtraInfo().o.x;
        o.y = vbh.GetExtraInfo().o.y;
        o.z = vbh.GetExtraInfo().o.z;
    }
    else
    {
        NS_LOG_DEBUG("not enter !m_hopByHop");
        // printf("m_hopByHop vbf is used\n");
        o.x = vbh.GetExtraInfo().f.x;
        o.y = vbh.GetExtraInfo().f.y;
        o.z = vbh.GetExtraInfo().f.z;
    }

    // NOTE below may not work if the nodes are mobile.
    /*double x=GetDevice()->CX();
    double y=GetDevice()->CY();
    double z=GetDevice()->CZ();
  */
    Vector myPos = GetDevice()->GetPosition();

    double wx = tx - o.x;
    double wy = ty - o.y;
    double wz = tz - o.z;

    double vx = myPos.x - o.x;
    double vy = myPos.y - o.y;
    double vz = myPos.z - o.z;
    // xiang liang cha cheng qiu mian ji,ci chu qiu wan hai shi xiang liang
    double cross_product_x = vy * wz - vz * wy;
    double cross_product_y = vz * wx - vx * wz;
    double cross_product_z = vx * wy - vy * wx;
    NS_LOG_DEBUG("cross_product_x:" << cross_product_x);
    NS_LOG_DEBUG("cross_product_y:" << cross_product_y);
    NS_LOG_DEBUG("cross_product_z:" << cross_product_z);

    NS_LOG_DEBUG("vx-vy-vz:" << vx << "-" << vy << "-" << vz);
    NS_LOG_DEBUG("wx-wy-wz:" << wx << "-" << wy << "-" << wz);
    NS_LOG_DEBUG("vy*wz:" << vy * wz);
    NS_LOG_DEBUG("vz*wy:" << vz * wy);
    // mian ji wei cha cheng hou de mo
    double area = sqrt(cross_product_x * cross_product_x + cross_product_y * cross_product_y +
                       cross_product_z * cross_product_z);
    double length =
        sqrt((tx - o.x) * (tx - o.x) + (ty - o.y) * (ty - o.y) + (tz - o.z) * (tz - o.z));
    // printf("vectorbasedforward: the area is %f and length is %f\n",area,length);
    NS_LOG_DEBUG("Projection: area is " << area << " length is " << length);
    NS_LOG_DEBUG("Projection: area is " << area << " length is " << length);
    if (length == 0)
    {
        return 0;
    }
    NS_LOG_DEBUG("Projection=" << area / length);
    return area / length;
}

bool
AquaSimVBF::IsTarget(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    // TODO
    // if (vbh.GetTargetAddr().GetAsInt()==1) {
    if (vbh.GetTargetAddr().GetAsInt() == 0)
    {
        //  printf("vectorbased: advanced is %lf and my range is %f\n",Advance(pkt),vbh.GetRange());
        return (Advance(pkt) < vbh.GetRange());
    }
    else
    {
        return (GetDevice()->GetAddress() == vbh.GetTargetAddr());
    }
}

bool
AquaSimVBF::IsCloseEnough(Ptr<Packet> pkt)
{
    // AquaVisualVbfHeader vbh;
    // AquaSimHeader ash;
    // pkt->RemoveHeader(ash);
    // pkt->PeekHeader(vbh);
    // pkt->AddHeader(ash);

    // double range=vbh.GetRange();  //unused
    // double range=m_width;

    //  printf("underwatersensor: The m_width is %f\n",range);
    // double ox=vbh.GetExtraInfo().o.x;  //unused
    // double oy=vbh.GetExtraInfo().o.y;  //unused
    // double oz=vbh.GetExtraInfo().o.z;  //unused

    /*
  double tx=vbh.GetExtraInfo().t.x;
    double ty=vbh.GetExtraInfo().t.y;
    double tz=vbh.GetExtraInfo().t.z;

    double fx=vbh.GetExtraInfo().f.x;
    double fy=vbh.GetExtraInfo().f.y;
    double fz=vbh.GetExtraInfo().f.z;
  */ // currently unused...

    // double x=GetDevice()->CX();  //unused  //change later
    // double y=GetDevice()->CY();  //unused
    // double z=GetDevice()->CZ();  //unused

    // double d=sqrt((tx-fx)*(tx-fx)+(ty-fy)*(ty-fy)+(tz-fz)*(tz-fz));  //unused
    // double l=sqrt((tx-ox)*(tx-ox)+(ty-oy)*(ty-oy)+ (tz-oz)*(tz-oz));
    // double l=Advance(pkt);  //unused
    //  if (l<range)
    //  {
    //  printf("vectorbasedforward: IsClose?too close! it should be target!\n");
    //  return true;
    //  }
    //  else {
    // double c=d/l;
    return Projection(pkt) <= m_width;
}

void
AquaSimVBF::DoDispose()
{
    m_rand = 0;
    AquaSimRouting::DoDispose();
}

void
AquaSimVBF::SetTargetPos(Vector pos)
{
    m_targetPos = pos;
}

// Some methods for Flooding Entry

/*
   void Vectorbasedforward_Entry::reset()
   {
   clear_agentlist(source);
   clear_agentlist(sink);
   source = NULL;
   sink = NULL;
   }

   void Vectorbasedforward_Entry::clear_agentlist(Agent_List *list)
   {
   Agent_List *cur=list;
   Agent_List *temp = NULL;

   while (cur != NULL) {
   temp = AGENT_NEXT(cur);
   delete cur;
   cur = temp;
   }
   }

 */

} // namespace ns3
`
