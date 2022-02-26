import React, { useEffect } from 'react'

export default function Chat({ socketRef }: any) {

    useEffect(() => {
        console.log(socketRef);
        
        if (socketRef) {
            socketRef.on('message', (message: string) => {
                console.log(message);

            })
        }

        return () => {

        }
    }, [socketRef])

    const onSendMessage = (e: any) => {
        e.preventDefault();
        const message = e.target.elements[0].value;
        if(socketRef) socketRef.emit('send-message','message')
    }


    return (
        <div>
            <form onSubmit={onSendMessage}>
                <input type="text" name='message' placeholder='message' required/>
                <button type='submit'>send</button>
            </form>
        </div>
    )
}
