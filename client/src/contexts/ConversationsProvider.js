import React, { useContext, useState, useCallback, useEffect } from 'react';
import useLocalStorage from '../hooks/useLocalStorage'
import { useContacts } from './ContactsProvider'
import { useSocket } from './SocketProvider'

const ConversationsContext = React.createContext()

export function useConversations() {
    return useContext(ConversationsContext)
}

export function ConversationsProvider({id, children }) {
  const [conversations, setConversations] = useLocalStorage('conversations', [])
  const {contacts} = useContacts()
  const [ selectedConversationIndex, setSelectedConversationIndex] = useState(0)
  const socket = useSocket()

  function createConversation(recipients, name) {
    setConversations(prevConversations => {
      return [...prevConversations, { name, recipients, messages: [] }]
    })
  }

  const addMessageToConversation = useCallback(({ name, recipients, text, sender }) => {
    setConversations( prevConversations => {
      let madeChange = false 
      let newMessage = { sender, text }
      
      const newConversations = prevConversations.map(conversation => {
        if (arrayEquality(conversation.recipients, recipients) && conversation.name === name) {
          madeChange = true
          return {
            ...conversation,
            messages: [...conversation.messages, newMessage]
          }
        }
        return conversation
      })

      if (madeChange) {
        return newConversations
      } else {
        return [
          ...prevConversations,
          { name, recipients, messages: [newMessage]}
        ]
      }
    })
  }, [setConversations])

  useEffect(() => {
    if (socket == null) return

    socket.on('receive-message', addMessageToConversation)

    return () => socket.off('receive-message')
  }, [socket, addMessageToConversation])

  function sendMessage(name, recipients, text) {
    socket.emit('send-message', {name, recipients, text})

    addMessageToConversation({ name, recipients, text, sender: id })
  }

  const formattedConversations = conversations.map((conversation, index) => {
      const conversationName = conversation.name

      const recipients = conversation.recipients.map(recipient => {
          const contact = contacts.find(contact => {
              return contact.id === recipient
          })
          const name = (contact && contact.name) || recipient
          return { id: recipient, name}
      })

      const messages = conversation.messages.map(msg => {
        const contact = contacts.find(contact => {
          return contact.id === msg.sender
        })
        const name = (contact && contact.name) || msg.sender
        const fromMe = msg.sender === id
        return {...msg, senderName: name, fromMe}
      })

      const selected = index === selectedConversationIndex

      return { ...conversations, name: conversationName, messages, recipients, selected }
  })

  const value = {
      conversations: formattedConversations,
      selectedConversation: formattedConversations[selectedConversationIndex],
      selectConversationIndex: setSelectedConversationIndex,
      createConversation,
      sendMessage
  }

  return ( 
      <ConversationsContext.Provider value={value}>
        {children}
      </ConversationsContext.Provider>
  )
}

function arrayEquality(a, b) {
  if (a.length !== b.length) return false

  a.sort()
  b.sort()

  return a.every((element, index) => {
    return element === b[index]
  })
}